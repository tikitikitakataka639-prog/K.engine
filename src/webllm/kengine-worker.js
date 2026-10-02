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

/** Valida la respuesta HTTP ANTES de que llegue a Cache API. Solo para recursos que K.ENGINE descarga directamente. */
async function fetchForCache(url, options = {}) {
  const response = await fetch(url, { ...options, cache: "no-store", redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Model resource HTTP ${response.status}: ${response.statusText} — ${url}`);
  }
  if (!response.body && !response.clone) {
    throw new Error(`Invalid response received for model resource: ${url}`);
  }
  return response;
}

const RETRY_DELAYS = [1000, 2500]; // espera tras el intento 1 y 2 (máx. 3 intentos)
const MAX_ATTEMPTS = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (m) => self.postMessage(m);

/** Errores transitorios de red/caché: los únicos que se reintentan. */
function isTransient(err) {
  const t = String((err && err.message) || err).toLowerCase();
  return /network|cache\.add|cache\.put|cachestorage|failed to fetch|fetch|http 5\d\d|http 4(08|29)|timeout|quota|load failed|econn/.test(t);
}

/** Prefijo de URL del modelo (misma normalización que cleanModelUrl de WebLLM). */
function modelPrefix(record) {
  let prefix = String(record.model);
  if (!prefix.endsWith("/")) prefix += "/";
  if (!prefix.includes("/resolve/")) prefix += "resolve/main/";
  return prefix;
}

/** Borra SOLO las entradas del modelo indicado en webllm/model. Nunca caches.delete() ni otros modelos. */
async function cleanPartialModel(record) {
  const prefix = modelPrefix(record);
  let removed = 0;
  try {
    const cache = await caches.open("webllm/model");
    for (const req of await cache.keys()) {
      if (req.url.startsWith(prefix) && (await cache.delete(req))) removed++;
    }
  } catch (e) {
    console.error("[K.ENGINE] No se pudo limpiar el estado parcial de " + record.model_id, e);
  }
  return removed;
}

function describeDownloadError(modelId, attempts, err) {
  const original = String((err && err.message) || err);
  const isCacheAdd = /cache\.add|cache\.put/i.test(original);
  return (
    "ERROR DE DESCARGA\n\n" +
    (isCacheAdd ? "No se pudo almacenar uno de los archivos del modelo." : "No se pudo descargar o almacenar el modelo.") +
    "\n\nSe ha limpiado el estado parcial y puedes reintentar.\n\nModelo: " +
    modelId +
    "\nIntentos: " +
    attempts +
    "\nERROR ORIGINAL: " +
    original
  );
}

/** Comprobaciones previas: modelo real, WebGPU y shader-f16. Lanza Error con mensaje claro. */
async function validateEnvironment(modelId) {
  const record = getWebLLMModel(modelId);
  if (!self.navigator || !self.navigator.gpu) throw new Error("WebGPU (navigator.gpu) no está disponible dentro del worker.");
  const needsF16 = (record.required_features || []).includes("shader-f16") || /q4f16|q0f16/.test(modelId);
  const adapter = await self.navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("WebGPU no devolvió ningún adaptador.");
  if (needsF16 && !adapter.features.has("shader-f16")) {
    throw new Error("El modelo " + modelId + " requiere shader-f16 y este adaptador no lo expone.");
  }
  return record;
}

let currentLoad = null; // modelId en curso: impide CreateMLCEngine simultáneos

/** Valida → descarga/carga con CreateMLCEngine (progreso REAL) → reintenta errores de red/caché → limpia parciales. */
async function loadModelWithRetry(modelId, options = {}) {
  const { maxAttempts = MAX_ATTEMPTS } = options;
  if (currentLoad) throw Object.assign(new Error("Ya hay una carga en curso (" + currentLoad + ")."), { fatal: true });
  currentLoad = modelId;
  try {
    post({ type: "MODEL_STATE", modelId, state: "VALIDATING" });
    const record = await validateEnvironment(modelId);
    let lastErr = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        post({ type: "status", value: "DOWNLOADING" });
        post({ type: "MODEL_STATE", modelId, state: "DOWNLOADING", attempt });
        // Pre-vuelo con respuesta validada: un 4xx/5xx da un error claro antes de que WebLLM toque Cache API.
        await fetchForCache(modelPrefix(record) + "mlc-chat-config.json");
        const eng = await CreateMLCEngine(record.model_id, {
          appConfig: prebuiltAppConfig,
          initProgressCallback: (p) => {
            const phase = phaseOf(p);
            const progress = p.progress || 0;
            post({ type: "progress", progress, text: p.text || "", phase });
            post({ type: "MODEL_PROGRESS", modelId, progress: Math.round(progress * 100), text: p.text || "" });
            if (phase === "LOADING") post({ type: "MODEL_STATE", modelId, state: "LOADING" });
          },
        });
        return { engine: eng, record, attempts: attempt };
      } catch (err) {
        lastErr = err;
        console.error("[K.ENGINE] Intento " + attempt + "/" + maxAttempts + " falló para " + modelId + ":", err);
        if (!isTransient(err)) throw Object.assign(err, { attempts: attempt });
        if (attempt < maxAttempts) {
          post({ type: "MODEL_STATE", modelId, state: "RETRYING", attempt, text: "Reintentando en " + RETRY_DELAYS[attempt - 1] + " ms…" });
          await sleep(RETRY_DELAYS[attempt - 1]);
        }
      }
    }
    const removed = await cleanPartialModel(record);
    console.error("[K.ENGINE] Descarga fallida tras " + maxAttempts + " intentos; entradas parciales eliminadas: " + removed, lastErr);
    throw Object.assign(new Error(describeDownloadError(modelId, maxAttempts, lastErr)), { attempts: maxAttempts, original: lastErr });
  } finally {
    currentLoad = null;
  }
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      if (loading) {
        post({ type: "error", scope: "load", message: "Ya hay una carga en curso." });
        return;
      }
      if (generating) {
        post({ type: "error", scope: "load", message: "Generación en curso; no se puede cargar otro modelo." });
        return;
      }
      if (engine && loadedModel === msg.model) {
        post({ type: "ready", model: msg.model, cached: true });
        return;
      }
      loading = true;
      try {
        if (engine) {
          post({ type: "status", value: "UNLOADING" });
          await engine.unload();
          engine = null;
          loadedModel = null;
        }
        try {
          const res = await loadModelWithRetry(msg.model);
          engine = res.engine;
        } catch (loadErr) {
          engine = null;
          const m = String((loadErr && loadErr.message) || loadErr);
          post({ type: "MODEL_STATE", modelId: msg.model, state: "ERROR" });
          post({ type: "error", scope: "load", message: m.startsWith("ERROR DE DESCARGA") ? m : "CreateMLCEngine falló para " + msg.model + ".\nERROR ORIGINAL: " + m });
          return;
        }
        loadedModel = msg.model;
        // Verificación real: una generación mínima antes de declarar READY.
        post({ type: "status", value: "VERIFYING" });
        const t0 = performance.now();
        const out = await engine.chat.completions.create({
          messages: [{ role: "user", content: "Responde únicamente con la palabra: ok" }],
          max_tokens: 8,
          temperature: 0,
          stream: false,
        });
        const text = out.choices[0]?.message?.content || "";
        if (!text) throw new Error("La verificación de generación no devolvió texto.");
        post({ type: "MODEL_READY", modelId: msg.model });
        post({ type: "verified", model: msg.model, ms: Math.round(performance.now() - t0) });
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
