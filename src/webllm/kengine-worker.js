// Versión FIJADA para reproducibilidad del diagnóstico (no "latest").
// esm.run (jsDelivr "+esm") puede lanzar "TypeError: Invalid URL" al
// evaluar el bundle; se usa el paquete npm primero, luego esm.sh y el build ESM oficial como
// fallback, probando cada fuente hasta que una exporte la API esperada.
const WEBLLM_SOURCES = [
  "https://esm.sh/@mlc-ai/web-llm@0.2.79",
  "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/lib/index.js",
  "https://esm.run/@mlc-ai/web-llm@0.2.79",
];
let webllm = null;
try {
  const mod = await import("@mlc-ai/web-llm");
  if (mod && mod.prebuiltAppConfig && mod.CreateMLCEngine) webllm = mod;
} catch (e) {
  console.error("[KERNEL WebLLM] Fallo importando paquete npm @mlc-ai/web-llm@0.2.79 →", e);
}
if (!webllm) {
  for (const src of WEBLLM_SOURCES) {
    try {
      const mod = await import(/* @vite-ignore */ src);
      if (mod && mod.prebuiltAppConfig && mod.CreateMLCEngine) {
        webllm = mod;
        break;
      }
    } catch (e) {
      console.error("[KERNEL WebLLM] Fallo importando " + src + " →", e);
    }
  }
}
if (!webllm) {
  self.postMessage({
    type: "error",
    scope: "load",
    message:
      "No se pudo importar @mlc-ai/web-llm@0.2.79 desde el paquete npm ni desde ningún CDN. Prueba:\n" +
      ["@mlc-ai/web-llm@0.2.79", ...WEBLLM_SOURCES].join("\n"),
  });
}

/* Sin interceptor de Cache API: WebLLM usa la implementación nativa del navegador. */

let engine = null;
let loadedModel = null;
let generating = false;

const MODEL_LIST = webllm ? webllm.prebuiltAppConfig.model_list : [];
const AVAILABLE_IDS = MODEL_LIST.map((m) => m.model_id);

/* ============================================================
   FUENTE ÚNICA DE VERDAD: prebuiltAppConfig.model_list.
   No hay configuración duplicada, ni URLs manuales, ni
   descarga manual con fetch()/Cache.add(). WebLLM gestiona
   sus propios artefactos y su propia caché.
   ============================================================ */

/**
 * Validación obligatoria antes de CreateMLCEngine:
 * nunca intentar cargar un model_id que no exista en
 * prebuiltAppConfig.model_list de la versión instalada.
 */
function getWebLLMModel(modelId) {
  if (!webllm) {
    throw new Error("WebLLM no está disponible en el worker.");
  }
  const model = MODEL_LIST.find((item) => item.model_id === modelId) || null;
  if (!model) {
    throw new Error(
      "Modelo no disponible en esta versión de WebLLM: " + modelId + ". Disponibles: " + AVAILABLE_IDS.join(", "),
    );
  }
  return model;
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === "models") {
      self.postMessage({
        type: "models",
        ids: AVAILABLE_IDS,
        records: MODEL_LIST.map((m) => ({
          id: m.model_id,
          vram_required_MB: m.vram_required_MB ?? null,
          low_resource_required: m.low_resource_required ?? null,
          url: m.model,
        })),
      });
      return;
    }

    if (msg.type === "load") {
      let record;
      try {
        record = getWebLLMModel(msg.model);
      } catch (vErr) {
        self.postMessage({ type: "error", scope: "load", message: String(vErr.message || vErr) });
        return;
      }

      console.log("[KERNEL] Modelo WebLLM seleccionado:", {
        model_id: record.model_id,
        model_lib: record.model_lib,
        model_url: record.model,
      });
      console.log("[KERNEL WebLLM] version:", webllm.version || "N/A (worker module)", "· Online:", navigator.onLine);
      if (generating) {
        self.postMessage({ type: "error", scope: "load", message: "Generación en curso; no se puede cargar otro modelo." });
        return;
      }
      if (engine && loadedModel === msg.model) {
        self.postMessage({ type: "ready", model: msg.model, cached: true });
        return;
      }
      if (engine) {
        self.postMessage({ type: "status", value: "UNLOADING" });
        await engine.unload();
        engine = null;
        loadedModel = null;
      }
      self.postMessage({ type: "status", value: "DOWNLOADING" });

      try {
        engine = await webllm.CreateMLCEngine(record.model_id, {
          appConfig: webllm.prebuiltAppConfig,
          initProgressCallback: (p) => {
            console.log("[KERNEL WebLLM]", p.text, Math.round((p.progress || 0) * 100) + "%");
            self.postMessage({
              type: "progress",
              progress: p.progress || 0,
              text: p.text || "",
              phase: p.progress && p.progress >= 1 ? "LOADING" : "DOWNLOADING",
            });
          },
        });
      } catch (loadErr) {
        console.error("[KERNEL WebLLM] Error real:", loadErr);
        self.postMessage({
          type: "error",
          scope: "load",
          message:
            "CreateMLCEngine falló para " +
            record.model_id +
            " (model_url: " +
            record.model +
            ").\nERROR ORIGINAL: " +
            String((loadErr && loadErr.message) || loadErr) +
            (loadErr && loadErr.stack ? "\nSTACK: " + loadErr.stack : ""),
        });
        throw loadErr;
      }
      loadedModel = msg.model;
      self.postMessage({ type: "status", value: "DOWNLOADED" });

      self.postMessage({ type: "status", value: "GENERATING" });
      const t0 = performance.now();
      const chunks = await engine.chat.completions.create({
        messages: [{ role: "user", content: "Responde únicamente con la palabra: ok" }],
        max_tokens: 8,
        temperature: 0,
        stream: false,
      });
      const text = chunks.choices[0]?.message?.content || "";
      if (!text) throw new Error("La verificación de generación no devolvió texto.");
      self.postMessage({ type: "verified", model: msg.model, ms: Math.round(performance.now() - t0) });
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
