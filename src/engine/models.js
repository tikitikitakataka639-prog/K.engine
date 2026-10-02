// Catálogo de modelos DERIVADO de prebuiltAppConfig.model_list (@mlc-ai/web-llm instalado).
// No hay lista duplicada de modelos: solo una lista de IDs "destacados" que se valida contra la real.
// Si un ID destacado no existe en la versión instalada, se descarta (y se informa en `missingFeatured`).

export const DEFAULT_MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
export const FEATURED_IDS = [
  DEFAULT_MODEL_ID,
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "Llama-3.2-3B-Instruct-q4f16_1-MLC",
];

let webllmPromise = null;
/** Carga perezosa del paquete npm (solo se usa en el hilo principal para metadatos y gestión de caché). */
export function loadWebLLM() {
  webllmPromise ||= import("@mlc-ai/web-llm");
  return webllmPromise;
}

function describe(record) {
  const id = record.model_id;
  const features = record.required_features || [];
  const needsF16 = features.includes("shader-f16") || /q4f16|q0f16/.test(id);
  const label = id.replace(/-MLC(-1k)?$/i, "").replace(/-Instruct/i, " Instruct").replace(/-q(\d)f(\d+)_(\d)/i, " · q$1f$2_$3");
  return {
    id,
    label,
    hf: String(record.model || "").replace("https://huggingface.co/", ""),
    vramMB: record.vram_required_MB ?? null,
    lowResource: record.low_resource_required ?? null,
    contextWindow: record.overrides?.context_window_size ?? null,
    requiredFeatures: needsF16 ? Array.from(new Set([...features, "shader-f16"])) : features,
    isVision: Boolean(record.model_type === 2 || /vision|llava/i.test(id)),
    featured: FEATURED_IDS.includes(id),
  };
}

/** @returns {Promise<{models: object[], featured: object[], missingFeatured: string[], version: string|null, total: number}>} */
export async function loadCatalog() {
  const webllm = await loadWebLLM();
  const list = webllm.prebuiltAppConfig.model_list;
  const byId = new Map(list.map((r) => [r.model_id, r]));
  const featured = FEATURED_IDS.filter((id) => byId.has(id)).map((id) => describe(byId.get(id)));
  const missingFeatured = FEATURED_IDS.filter((id) => !byId.has(id));
  const models = list.map(describe);
  return { models, featured, missingFeatured, version: webllm.version || null, total: list.length };
}
