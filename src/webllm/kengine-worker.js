// Worker de K.ENGINE: aquí vive WebLLM (dependencia npm empaquetada por Vite; sin CDN).
// Flujo: main → EngineProvider → ModelManager → este Worker → @mlc-ai/web-llm → WebGPU.
import { prebuiltAppConfig, CreateMLCEngine } from "@mlc-ai/web-llm";

let engine = null;
let loadedModel = null;
let generating = false;
let loading = false;

const MODEL_LIST = prebuiltAppConfig.model_list;
const AVAILABLE_IDS = MODEL_LIST.map((m) => m.model_id);

/** Fuente única de verdad: prebuiltAppConfig.model_list. Nunca se carga un ID que no esté ahí. */
function getWebLLMModel(modelId) {
  const model = MODEL_LIST.find((item) => item.model_id === modelId) || null;
  if (!model) {
    throw new Error("Modelo no disponible en esta versión de WebLLM: " + modelId + " (" + AVAILABLE_IDS.length + " modelos conocidos).");
  }
  return model;
}

/** Fase real según el texto que emite WebLLM en initProgressCallback. */
function phaseOf(p) {
  const t = (p.text || "").toLowerCase();
  if (t.includes("fetching")) return "DOWNLOADING";
  if (t.includes("loading model from cache") || t.includes("loading gpu shader") || t.includes("finish loading")) return "LOADING";
  return p.progress >= 1 ? "LOADING" : "DOWNLOADING";
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      let record;
      try {
        record = getWebLLMModel(msg.model);
      } catch (vErr) {
        self.postMessage({ type: "error", scope: "load", message: String(vErr.message || vErr) });
        return;
      }
      if (!self.navigator || !self.navigator.gpu) {
        self.postMessage({ type: "error", scope: "load", message: "WebGPU (navigator.gpu) no está disponible dentro del worker." });
        return;
      }
      if (loading) {
        self.postMessage({ type: "error", scope: "load", message: "Ya hay una carga en curso." });
        return;
      }
      if (generating) {
        self.postMessage({ type: "error", scope: "load", message: "Generación en curso; no se puede cargar otro modelo." });
        return;
      }
      if (engine && loadedModel === msg.model) {
        self.postMessage({ type: "ready", model: msg.model, cached: true });
        return;
      }
      loading = true;
      try {
        if (engine) {
          self.postMessage({ type: "status", value: "UNLOADING" });
          await engine.unload();
          engine = null;
          loadedModel = null;
        }
        self.postMessage({ type: "status", value: "DOWNLOADING" });
        try {
          // useIndexedDBCache: HuggingFace redirige los shards (.bin) a un CDN cross-origin
          // (us.aws.cdn.hf.co) cuyas respuestas Cache.add()/Cache.put() no pueden almacenar.
          // IndexedDB usa fetch() directo y no tiene esa limitación.
          engine = await CreateMLCEngine(record.model_id, {
            appConfig: { ...prebuiltAppConfig, useIndexedDBCache: true },
            initProgressCallback: (p) => {
              self.postMessage({ type: "progress", progress: p.progress || 0, text: p.text || "", phase: phaseOf(p) });
            },
          });
        } catch (loadErr) {
          engine = null;
          self.postMessage({
            type: "error",
            scope: "load",
            message:
              "CreateMLCEngine falló para " + record.model_id + ".\nERROR ORIGINAL: " + String((loadErr && loadErr.message) || loadErr),
          });
          return;
        }
        loadedModel = msg.model;
        // Verificación real: una generación mínima antes de declarar READY.
        self.postMessage({ type: "status", value: "VERIFYING" });
        const t0 = performance.now();
        const out = await engine.chat.completions.create({
          messages: [{ role: "user", content: "Responde únicamente con la palabra: ok" }],
          max_tokens: 8,
          temperature: 0,
          stream: false,
        });
        const text = out.choices[0]?.message?.content || "";
        if (!text) throw new Error("La verificación de generación no devolvió texto.");
        self.postMessage({ type: "verified", model: msg.model, ms: Math.round(performance.now() - t0) });
      } finally {
        loading = false;
      }
    } else if (msg.type === "generate") {
      if (!engine || loadedModel !== msg.model) {
        self.postMessage({ type: "error", scope: "generate", message: "El modelo no está cargado." });
        return;
      }
      generating = true;
      self.postMessage({ type: "genstart", id: msg.id });
      const t0 = performance.now();
      let firstTokenMs = null;
      const chunks = await engine.chat.completions.create({
        messages: msg.messages,
        temperature: 0.7,
        max_tokens: msg.max_tokens || 1024,
        stream: true,
        stream_options: { include_usage: true },
      });
      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          if (firstTokenMs === null) firstTokenMs = Math.round(performance.now() - t0);
          self.postMessage({ type: "token", id: msg.id, delta });
        }
        if (chunk.usage) {
          self.postMessage({
            type: "usage",
            id: msg.id,
            completionTokens: chunk.usage.completion_tokens,
            genMs: Math.round(performance.now() - t0),
            firstTokenMs,
            tps:
              chunk.usage.completion_tokens && chunk.choices[0]?.finish_reason
                ? +(chunk.usage.completion_tokens / ((performance.now() - t0) / 1000)).toFixed(1)
                : null,
          });
        }
      }
      generating = false;
      self.postMessage({ type: "gendone", id: msg.id });
    } else if (msg.type === "diagnose") {
      const rec = getWebLLMModel(msg.model);
      const base = rec.model.replace(/\/+$/, "") + "/resolve/main/";
      const probe = async (url) => {
        try {
          const r = await fetch(url, { headers: { Range: "bytes=0-0" } });
          return { url, ok: r.ok, status: r.status, redirected: r.redirected, finalUrl: r.redirected ? r.url : undefined, type: r.type };
        } catch (e) {
          return { url, ok: false, error: String((e && e.message) || e) };
        }
      };
      const post = (item) => self.postMessage({ type: "diag", item });
      post(await probe(rec.model_lib));
      for (const f of ["mlc-chat-config.json", "tokenizer.json"]) post(await probe(base + f));
      let cacheJson = null;
      try {
        const r = await fetch(base + "ndarray-cache.json");
        post({ url: base + "ndarray-cache.json", ok: r.ok, status: r.status, type: r.type });
        if (r.ok) cacheJson = await r.json();
      } catch (e) {
        post({ url: base + "ndarray-cache.json", ok: false, error: String((e && e.message) || e) });
      }
      if (cacheJson && Array.isArray(cacheJson.records)) for (const rc of cacheJson.records) post(await probe(base + rc.dataPath));
      const last = (performance.getEntriesByType("resource") || [])
        .slice(-8)
        .map((e) => ({ name: e.name, status: e.responseStatus ?? null, transferSize: e.transferSize, ms: Math.round(e.duration) }));
      self.postMessage({ type: "diag_done", model: rec.model_id, lastResources: last });
    } else if (msg.type === "cancel") {
      if (engine) engine.interruptGenerate();
    } else if (msg.type === "unload") {
      if (generating) {
        self.postMessage({ type: "error", scope: "unload", message: "No se puede descargar de memoria durante la generación." });
        return;
      }
      if (engine) {
        self.postMessage({ type: "status", value: "UNLOADING" });
        await engine.unload();
        engine = null;
        loadedModel = null;
        self.postMessage({ type: "unloaded" });
      }
    }
  } catch (err) {
    generating = false;
    const message = String((err && err.message) || err);
    console.error("[WebLLM] Error del worker:", err);
    self.postMessage({ type: "error", scope: msg.type || "unknown", message });
  }
};
