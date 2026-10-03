// Clasificación de errores de K.ENGINE.
// Mensajes en español, suficientes para diagnosticar sin mostrar detalles técnicos innecesarios.

export const ErrorType = {
  WEBGPU_UNAVAILABLE: "WEBGPU_UNAVAILABLE",
  ADAPTER_UNAVAILABLE: "ADAPTER_UNAVAILABLE",
  SHADER_F16_MISSING: "SHADER_F16_MISSING",
  MODEL_NOT_FOUND: "MODEL_NOT_FOUND",
  CONFIG_ERROR: "CONFIG_ERROR",
  DOWNLOAD_ERROR: "DOWNLOAD_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  CACHE_API_ERROR: "CACHE_API_ERROR",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  MEMORY_ERROR: "MEMORY_ERROR",
  WEBLLM_ERROR: "WEBLLM_ERROR",
  WORKER_ERROR: "WORKER_ERROR",
  GENERATION_ERROR: "GENERATION_ERROR",
  UNKNOWN: "UNKNOWN",
};

const MESSAGES = {
  [ErrorType.WEBGPU_UNAVAILABLE]: "WebGPU no está disponible. Necesitas Chrome/Edge 113+ con WebGPU activo y un contexto seguro (https o localhost).",
  [ErrorType.ADAPTER_UNAVAILABLE]: "No se pudo obtener un adaptador WebGPU. Revisa los drivers de tu GPU o si está en lista negra del navegador.",
  [ErrorType.SHADER_F16_MISSING]: "El adaptador no soporta shader-f16. Los modelos q4f16 no se pueden cargar. Existen variantes q4f32 en la lista de WebLLM.",
  [ErrorType.MODEL_NOT_FOUND]: "El modelo no existe en la configuración de WebLLM instalada.",
  [ErrorType.CONFIG_ERROR]: "Error de configuración del modelo.",
  [ErrorType.DOWNLOAD_ERROR]: "Error durante la descarga del modelo desde Hugging Face.",
  [ErrorType.NETWORK_ERROR]: "Error de red al descargar el modelo. Verifica tu conexión a internet.",
  [ErrorType.CACHE_API_ERROR]: "Error en la Cache API del navegador. La caché del modelo puede estar corrupta.",
  [ErrorType.QUOTA_EXCEEDED]: "Cuota de almacenamiento del navegador agotada. Libera espacio o limpia la caché del modelo.",
  [ErrorType.MEMORY_ERROR]: "Error de memoria. La GPU podría no tener suficiente VRAM para este modelo.",
  [ErrorType.WEBLLM_ERROR]: "Error interno de WebLLM durante la carga o generación.",
  [ErrorType.WORKER_ERROR]: "Error del Web Worker de K.ENGINE.",
  [ErrorType.GENERATION_ERROR]: "Error durante la generación de texto.",
  [ErrorType.UNKNOWN]: "Error desconocido.",
};

export class KEngineError extends Error {
  constructor(type, originalMessage) {
    const message = MESSAGES[type] || MESSAGES[ErrorType.UNKNOWN];
    super(message);
    this.name = "KEngineError";
    this.type = type;
    this.originalMessage = originalMessage || "";
  }
  get fullMessage() {
    if (this.originalMessage && this.originalMessage !== this.message) {
      return this.message + "\nDetalle: " + this.originalMessage;
    }
    return this.message;
  }
}

/** Clasifica un error arbitrario en un KEngineError tipado con mensaje en español. */
export function classifyError(err) {
  const raw = err && err.message ? err.message : String(err);
  const msg = raw.toLowerCase();

  if (/navigator\.gpu|webgpu.*(not available|no disponible)/.test(msg))
    return new KEngineError(ErrorType.WEBGPU_UNAVAILABLE, raw);
  if (/requestadapter|adapter.*(null|no devuel)/.test(msg))
    return new KEngineError(ErrorType.ADAPTER_UNAVAILABLE, raw);
  if (/shader-f16|shaderf16/.test(msg))
    return new KEngineError(ErrorType.SHADER_F16_MISSING, raw);
  if (/modelo.*(not available|no disponible|not found|no encontrado)/.test(msg) || /not available in this version/.test(msg))
    return new KEngineError(ErrorType.MODEL_NOT_FOUND, raw);
  if (/quota|exceeded|excedida/.test(msg))
    return new KEngineError(ErrorType.QUOTA_EXCEEDED, raw);
  if (/cache|failed to execute 'add'|unexpected internal error/.test(msg))
    return new KEngineError(ErrorType.CACHE_API_ERROR, raw);
  if (/out of memory|oom|memory|memoria/.test(msg))
    return new KEngineError(ErrorType.MEMORY_ERROR, raw);
  if (/network|fetch|dns|cors|red/.test(msg))
    return new KEngineError(ErrorType.NETWORK_ERROR, raw);
  if (/worker|import.*module/.test(msg))
    return new KEngineError(ErrorType.WORKER_ERROR, raw);
  if (/generat|completion|chat\.completions/.test(msg))
    return new KEngineError(ErrorType.GENERATION_ERROR, raw);
  if (/createmlcengine|webllm|mlc/.test(msg))
    return new KEngineError(ErrorType.WEBLLM_ERROR, raw);

  return new KEngineError(ErrorType.UNKNOWN, raw);
}

/** ¿El error parece de Cache API o red (recuperable limpiando caché)? */
export function isCacheError(msg) {
  const m = String(msg || "").toLowerCase();
  return (
    m.includes("cache") ||
    m.includes("failed to execute 'add'") ||
    m.includes("unexpected internal error") ||
    m.includes("network error") ||
    (m.includes("fetch") && !m.includes("fetching"))
  );
}
