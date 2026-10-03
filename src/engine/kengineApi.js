// API interna de K.ENGINE para KERNEL.
// KERNEL habla con esta API; los detalles de WebLLM, workers, WebGPU y Cache Storage quedan encapsulados.
//
//   KERNEL → kengine.initialize() → kengine.loadModel() → kengine.generate() / kengine.stream()
//
// Esta API NO expone CreateMLCEngine, workers, configuración MLC, Cache Storage ni detalles de WebGPU.

import { modelManager, IN_MEMORY } from "./modelManager";
import { detectHardware, emptyHardware, CLASS } from "./hardware";
import { KERNEL_PERSONALITY } from "./personality";
import { autoSelectModel } from "./models";
import { classifyError } from "./errors";

class KEngineAPI {
  /** Inicializa el motor: detecta hardware, carga el catálogo y selecciona automáticamente el mejor modelo. */
  async initialize() {
    const hw = await detectHardware();
    modelManager.setHardware(hw);
    await modelManager.init();
    const snap = modelManager.getSnapshot();
    const best = autoSelectModel(hw, snap.catalog);
    if (best) modelManager.select(best);
    return {
      hardware: hw,
      catalog: snap.catalog,
      selectedModel: best || snap.selectedId,
    };
  }

  /** Descarga (si hace falta) y carga el modelo en GPU. Si no se pasa modelId, usa el seleccionado automáticamente. */
  async loadModel(modelId) {
    const id = modelId || modelManager.getSnapshot().selectedId;
    if (!id) throw new Error("No hay modelo seleccionado.");
    return modelManager.download(id);
  }

  /** Libera el modelo de la memoria (GPU/RAM). Conserva los datos en disco. */
  async unloadModel() {
    return modelManager.unload();
  }

  /** Genera una respuesta sin streaming. Devuelve { text, metrics }. */
  async generate(messages, options = {}) {
    const snap = modelManager.getSnapshot();
    const id = snap.loadedId;
    if (!id || !IN_MEMORY.includes(snap.models[id]?.status)) {
      throw new Error("No hay modelo cargado en estado READY.");
    }
    const sysMessages = [{ role: "system", content: KERNEL_PERSONALITY.systemPrompt }, ...messages];
    return new Promise((resolve, reject) => {
      const genId = Date.now();
      let text = "";
      let metrics = {};
      const off = modelManager.onMessage((d) => {
        if (d.id !== genId) return;
        if (d.type === "token") text += d.delta;
        else if (d.type === "usage") {
          metrics = {
            tokens: d.completionTokens,
            genTime: d.genMs,
            firstTokenMs: d.firstTokenMs,
            tps: d.tps,
          };
        } else if (d.type === "gendone") {
          off();
          resolve({ text, metrics });
        } else if (d.type === "error" && d.scope === "generate") {
          off();
          reject(classifyError(new Error(d.message)));
        }
      });
      modelManager.generate({ id: genId, model: id, messages: sysMessages, max_tokens: options.maxTokens });
    });
  }

  /** Genera una respuesta con streaming. Llama onToken por cada token. Devuelve { text, metrics }. */
  async stream(messages, onToken, options = {}) {
    const snap = modelManager.getSnapshot();
    const id = snap.loadedId;
    if (!id || !IN_MEMORY.includes(snap.models[id]?.status)) {
      throw new Error("No hay modelo cargado en estado READY.");
    }
    const sysMessages = [{ role: "system", content: KERNEL_PERSONALITY.systemPrompt }, ...messages];
    return new Promise((resolve, reject) => {
      const genId = Date.now();
      let text = "";
      let metrics = {};
      const off = modelManager.onMessage((d) => {
        if (d.id !== genId) return;
        if (d.type === "token") {
          text += d.delta;
          if (onToken) onToken(d.delta);
        } else if (d.type === "usage") {
          metrics = {
            tokens: d.completionTokens,
            genTime: d.genMs,
            firstTokenMs: d.firstTokenMs,
            tps: d.tps,
          };
        } else if (d.type === "gendone") {
          off();
          resolve({ text, metrics });
        } else if (d.type === "error" && d.scope === "generate") {
          off();
          reject(classifyError(new Error(d.message)));
        }
      });
      modelManager.generate({ id: genId, model: id, messages: sysMessages, max_tokens: options.maxTokens });
    });
  }

  /** Cancela la generación en curso. */
  cancel() {
    modelManager.cancelGenerate();
  }

  /** Devuelve el estado completo del motor. */
  getStatus() {
    const snap = modelManager.getSnapshot();
    return {
      ready: snap.ready,
      selectedModel: snap.selectedId,
      loadedModel: snap.loadedId,
      operation: snap.opKind,
      models: Object.fromEntries(
        Object.entries(snap.models).map(([id, m]) => [id, { status: m.status, progress: m.progress, error: m.error }]),
      ),
    };
  }

  /** Devuelve las capacidades detectadas del hardware y la compatibilidad de cada modelo. */
  getCapabilities() {
    const snap = modelManager.getSnapshot();
    const hw = modelManager.hw || emptyHardware();
    return {
      webgpu: hw.checked ? hw.adapter : null,
      shaderF16: hw.shaderF16,
      deviceOk: hw.deviceOk,
      cores: hw.cores,
      deviceMemoryGB: hw.deviceMemoryGB,
      models: snap.catalog.featured.map((m) => {
        const cls = modelManager.classify(m.id);
        return {
          id: m.id,
          label: m.label,
          vramMB: m.vramMB,
          compatible: cls ? cls.level !== CLASS.INCOMPATIBLE : null,
          classification: cls ? cls.level : null,
          blocking: cls ? cls.blocking : null,
        };
      }),
    };
  }

  /** Elimina los datos locales de un modelo de la caché. Si no se pasa modelId, usa el seleccionado. */
  async clearModelCache(modelId) {
    const id = modelId || modelManager.getSnapshot().selectedId;
    if (!id) throw new Error("No hay modelo seleccionado.");
    return modelManager.deleteModel(id);
  }

  /** Selecciona automáticamente el mejor modelo compatible con el hardware. */
  selectBestModel() {
    const snap = modelManager.getSnapshot();
    const hw = modelManager.hw;
    if (!hw || !hw.checked) return null;
    const best = autoSelectModel(hw, snap.catalog, modelManager.manual);
    if (best) modelManager.select(best);
    return best;
  }

  /** Devuelve la personalidad de KERNEL (system prompt). */
  getPersonality() {
    return KERNEL_PERSONALITY;
  }
}

export const kengine = new KEngineAPI();
export default kengine;
