"use strict";
// Catálogo de modelos WebLLM (backend de navegador). Fuente para /models.
// webllm_id debe coincidir EXACTAMENTE con prebuiltAppConfig.model_list de @mlc-ai/web-llm@0.2.79.
// El catálogo de la UI (src/webllm/catalog.js, MODEL_CATALOG) usa los mismos webllm_id y añade `slug`.
const WEBLLM_MODELS = [
  { id: "llama-3.2-1b", webllm_id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", hf: "mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC", priority: true },
  { id: "qwen2.5-0.5b", webllm_id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC" },
  { id: "qwen2.5-1.5b", webllm_id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC" },
  { id: "llama-3.2-3b", webllm_id: "Llama-3.2-3B-Instruct-q4f16_1-MLC" }
];
const bySlug = (s) => WEBLLM_MODELS.find(m => m.id === s) || null;
const byWebllmId = (w) => WEBLLM_MODELS.find(m => m.webllm_id === w) || null;
export { WEBLLM_MODELS, bySlug, byWebllmId };
export default { WEBLLM_MODELS, bySlug, byWebllmId };
