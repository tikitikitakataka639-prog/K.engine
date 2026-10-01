// Los IDs deben coincidir EXACTAMENTE con prebuiltAppConfig.model_list de
// @mlc-ai/web-llm (IDs cortos, sin prefijo mlc-ai/). El worker revalida cada
// ID contra MODEL_LIST antes de cargar; si no existe, muestra error claro.
export const MODEL_CATALOG = [
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    slug: "llama-3.2-1b",
    hf: "mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 1B Instruct",
    short: "Llama 3.2 1B",
    tier: "LIGHT",
    active: true,
    vram: "4 GB",
    size: "~705 MB descarga",
    quant: "q4f16_1",
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    slug: "qwen2.5-0.5b",
    hf: "mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 0.5B Instruct",
    short: "Qwen 2.5 0.5B",
    tier: "LIGHT",
    vram: "3 GB",
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    slug: "qwen2.5-1.5b",
    hf: "mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 1.5B Instruct",
    short: "Qwen 2.5 1.5B",
    tier: "MEDIUM",
    vram: "5 GB",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    slug: "llama-3.2-3b",
    hf: "mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B Instruct",
    short: "Llama 3.2 3B",
    tier: "MEDIUM",
    vram: "8 GB",
  },
  {
    id: "Llava-1.5-7B-HF-q4f16_1-MLC.1k",
    slug: "llava-1.5",
    hf: "mlc-ai/Llava-1.5-7B-HF-q4f16_1-MLC.1k",
    label: "LLaVA 1.5 (Visión)",
    short: "LLaVA 1.5",
    tier: "VISION",
    vram: "12 GB",
  },
];

export const DEFAULT_MODEL_ID = MODEL_CATALOG[0].id;
export const PRIORITY_HF = "mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC";
export const PRIORITY_SLUG = "llama-3.2-1b";

export const STATUS_LABELS = {
  NOT_INSTALLED: ["bg-slate-600", "MODEL NOT READY"],
  DOWNLOADING: ["bg-amber2 blinking", "DOWNLOADING"],
  DOWNLOADED: ["bg-sky-400", "DOWNLOADED"],
  LOADING: ["bg-amber2 blinking", "LOADING"],
  READY: ["bg-volt", "READY"],
  GENERATING: ["bg-volt blinking", "GENERATING"],
  UNLOADING: ["bg-amber2 blinking", "UNLOADING"],
  ERROR: ["bg-red2", "ERROR"],
};
