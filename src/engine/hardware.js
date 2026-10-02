// Detección de WebGPU y clasificación de modelos según hardware.
// El navegador NO expone VRAM ni RAM reales: lo que no se puede medir se marca como estimación.

const LIMIT_KEYS = [
  "maxBufferSize",
  "maxStorageBufferBindingSize",
  "maxComputeWorkgroupStorageSize",
  "maxComputeInvocationsPerWorkgroup",
  "maxComputeWorkgroupSizeX",
  "maxStorageBuffersPerShaderStage",
];

export function emptyHardware() {
  return {
    checked: false,
    secureContext: typeof isSecureContext === "boolean" ? isSecureContext : null,
    hasNavigatorGpu: false,
    adapter: false,
    deviceOk: null,
    deviceError: null,
    shaderF16: false,
    features: [],
    limits: {},
    info: {},
    fallbackAdapter: null,
    cores: null,
    deviceMemoryGB: null,
    problems: [],
  };
}

/** Comprueba navigator.gpu → requestAdapter() → features/limits → requestDevice() real. */
export async function detectHardware() {
  const hw = emptyHardware();
  hw.checked = true;
  hw.cores = navigator.hardwareConcurrency || null;
  hw.deviceMemoryGB = navigator.deviceMemory || null; // tope 8 y redondeado por el navegador
  hw.hasNavigatorGpu = Boolean(navigator.gpu);
  if (!hw.hasNavigatorGpu) {
    hw.problems.push(
      hw.secureContext === false
        ? "navigator.gpu no existe: la página no está en un contexto seguro (usa https:// o localhost)."
        : "navigator.gpu no existe: este navegador no soporta WebGPU (necesitas Chrome/Edge 113+ o equivalente con WebGPU activo).",
    );
    return hw;
  }
  let adapter = null;
  try {
    adapter = await navigator.gpu.requestAdapter();
  } catch (e) {
    hw.problems.push("requestAdapter() lanzó un error: " + ((e && e.message) || e));
    return hw;
  }
  if (!adapter) {
    hw.problems.push("requestAdapter() devolvió null: no hay GPU utilizable (drivers, GPU en lista negra o navegador sin aceleración).");
    return hw;
  }
  hw.adapter = true;
  hw.features = Array.from(adapter.features || []);
  hw.shaderF16 = hw.features.includes("shader-f16");
  for (const k of LIMIT_KEYS) if (adapter.limits && adapter.limits[k] != null) hw.limits[k] = adapter.limits[k];
  try {
    const info = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : {});
    hw.info = { vendor: info.vendor || "", architecture: info.architecture || "", description: info.description || "", device: info.device || "" };
  } catch {
    /* sin info */
  }
  hw.fallbackAdapter = adapter.isFallbackAdapter ?? null;
  if (hw.fallbackAdapter) hw.problems.push("El adaptador es de software (fallback): la inferencia será extremadamente lenta.");
  if (!hw.shaderF16) hw.problems.push("El adaptador no expone shader-f16: los modelos q4f16 no se cargarán (existen variantes q4f32 en la lista de WebLLM).");
  // Prueba real: ¿se puede crear un dispositivo con las features pedidas?
  try {
    const device = await adapter.requestDevice({ requiredFeatures: hw.shaderF16 ? ["shader-f16"] : [] });
    hw.deviceOk = true;
    device.destroy();
  } catch (e) {
    hw.deviceOk = false;
    hw.deviceError = (e && e.message) || String(e);
    hw.problems.push("requestDevice() falló: " + hw.deviceError);
  }
  return hw;
}

export const CLASS = {
  RECOMMENDED: "RECOMENDADO",
  POSSIBLE: "POSIBLE",
  HEAVY: "PESADO",
  INCOMPATIBLE: "NO COMPATIBLE",
};

const GB = 1024;

function downgrade(level) {
  return level === CLASS.RECOMMENDED ? CLASS.POSSIBLE : level === CLASS.POSSIBLE ? CLASS.HEAVY : level;
}

/**
 * Clasifica un modelo para el hardware detectado + valores introducidos por el usuario.
 * @param model  entrada de loadCatalog() (vramMB, requiredFeatures…)
 * @param hw     resultado de detectHardware()
 * @param manual { vramGB?: number } valores que el usuario declara (el navegador no los expone)
 * @returns {{ level: string, reasons: string[], blocking: boolean, estimated: boolean }}
 *   blocking=true => requisito duro no cumplido (no se intenta cargar).
 */
export function classifyModel(model, hw, manual = {}) {
  const reasons = [];
  if (!hw || !hw.checked) return { level: CLASS.POSSIBLE, reasons: ["Hardware sin comprobar todavía."], blocking: false, estimated: true };
  if (!hw.hasNavigatorGpu) return { level: CLASS.INCOMPATIBLE, reasons: ["Falta WebGPU (navigator.gpu)."], blocking: true, estimated: false };
  if (!hw.adapter) return { level: CLASS.INCOMPATIBLE, reasons: ["requestAdapter() no devolvió adaptador."], blocking: true, estimated: false };
  if (hw.deviceOk === false) {
    return { level: CLASS.INCOMPATIBLE, reasons: ["No se puede crear un dispositivo WebGPU: " + hw.deviceError], blocking: true, estimated: false };
  }
  const missing = (model.requiredFeatures || []).filter((f) => !hw.features.includes(f));
  if (missing.length) {
    return { level: CLASS.INCOMPATIBLE, reasons: ["Falta la característica WebGPU requerida: " + missing.join(", ") + "."], blocking: true, estimated: false };
  }

  const need = model.vramMB;
  const vramMB = manual.vramGB ? manual.vramGB * GB : null;
  let level;
  let estimated = false;
  if (need && vramMB) {
    const ratio = vramMB / need;
    level = ratio >= 1.5 ? CLASS.RECOMMENDED : ratio >= 1.1 ? CLASS.POSSIBLE : ratio >= 0.85 ? CLASS.HEAVY : CLASS.INCOMPATIBLE;
    reasons.push("Necesita ~" + need + " MB de VRAM; declaras " + manual.vramGB + " GB.");
  } else {
    estimated = true;
    const maxBuf = hw.limits.maxBufferSize || 0;
    level = !need ? CLASS.POSSIBLE : need <= 1600 ? CLASS.RECOMMENDED : need <= 3500 ? CLASS.POSSIBLE : CLASS.HEAVY;
    if (need) reasons.push("Necesita ~" + need + " MB de VRAM. El navegador no expone tu VRAM: clasificación estimada.");
    if (maxBuf && maxBuf < 1024 ** 3) {
      level = downgrade(level);
      reasons.push("maxBufferSize del adaptador bajo (" + Math.round(maxBuf / 1024 ** 2) + " MB).");
    }
    if (hw.deviceMemoryGB && need && hw.deviceMemoryGB * GB < need) {
      level = downgrade(level);
      reasons.push("RAM reportada (" + hw.deviceMemoryGB + " GB, tope del navegador) inferior al requisito.");
    }
  }
  if (hw.fallbackAdapter) {
    level = downgrade(level);
    reasons.push("Adaptador de software: muy lento.");
  }
  reasons.push("La compatibilidad real solo se confirma al cargar el modelo.");
  // Con VRAM declarada insuficiente se avisa pero el usuario puede forzar manualmente (no es un límite del navegador).
  return { level, reasons, blocking: false, estimated };
}

export const fmtMB = (n) => (n == null ? "—" : n >= 1024 ? (n / 1024).toFixed(1) + " GB" : Math.round(n) + " MB");
