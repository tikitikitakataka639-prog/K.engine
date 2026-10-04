/**
 * Valida la URL de la interfaz KERNEL.
 * No se inventa ninguna ni se conecta sola.
 * @param {string} raw
 * @returns {{ ok: true, url: string } | { ok: false, error: string }}
 */
export function parseKernelUrl(raw) {
  const v = (raw || "").trim();
  if (!v) return { ok: false, error: "Introduce una URL." };
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol))
      return { ok: false, error: "Solo se admiten URLs http:// o https://." };
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false, error: "URL no válida (ejemplo de formato: https://host/ruta)." };
  }
}
