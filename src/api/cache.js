const MB = 1024 * 1024;
export const fmtBytes = (n) =>
  n >= 1024 * MB ? (n / 1024 / MB).toFixed(2) + " GB" : (n / MB).toFixed(1) + " MB";

const isOurs = (n) => /^(webllm|kengine)/i.test(n);
const groupOf = (url) => {
  const i = url.indexOf("/resolve/");
  return i > 0
    ? url.slice(0, i)
    : (() => {
        try {
          const u = new URL(url);
          return u.origin + u.pathname.split("/").slice(0, 3).join("/");
        } catch {
          return url;
        }
      })();
};

export async function scanCaches() {
  if (!("caches" in window)) return { supported: false, caches: [], groups: new Map(), total: 0, knownBytes: 0, unknown: 0 };
  const names = (await caches.keys()).filter(isOurs);
  const groups = new Map();
  let total = 0,
    knownBytes = 0,
    unknown = 0;
  for (const name of names) {
    const c = await caches.open(name);
    for (const req of await c.keys()) {
      total++;
      const resp = await c.match(req);
      const len = resp && resp.headers.get("content-length");
      const size = len != null && len !== "" && !isNaN(+len) ? +len : null;
      if (size == null) unknown++;
      else knownBytes += size;
      const g = groupOf(req.url);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push({ cache: name, req, size, ok: resp ? resp.ok : false, status: resp ? resp.status : 0 });
    }
  }
  return { supported: true, caches: names, groups, total, knownBytes, unknown };
}

export async function cacheApiSelfTest() {
  if (!("caches" in window)) return { ok: false, detail: "Cache API no disponible (¿contexto no seguro/Origin null?)" };
  try {
    const c = await caches.open("kengine-selftest");
    const req = new Request(location.origin + "/__kengine_selftest__");
    await c.put(req, new Response("ok"));
    const back = await c.match(req);
    await caches.delete("kengine-selftest");
    return { ok: !!back, detail: back ? "put/match/delete correctos" : "put sin match" };
  } catch (e) {
    return { ok: false, detail: "falló: " + (e && e.name) + ": " + (e && e.message) };
  }
}

export function classify(items, selftest) {
  const bad = items.filter((i) => !i.ok);
  if (!selftest.ok) return "CAUSA: Cache API del navegador (" + selftest.detail + "). No es la red.";
  if (!bad.length)
    return "Todos los recursos responden desde el worker y la Cache API funciona. El fallo no es de red/CORS/HF en este momento: revisa cuota de almacenamiento, entradas corruptas en caché o un fallo intermitente.";
  const net = bad.filter((i) => i.error),
    http = bad.filter((i) => i.status);
  const parts = [];
  if (net.length)
    parts.push(
      net.length +
        " recurso(s) rechazados por fetch (sin respuesta: red/DNS, CORS, bloqueo por extensión/firewall o redirección sin cabeceras CORS). Primero: " +
        net[0].url +
        " → " +
        net[0].error,
    );
  if (http.length) parts.push(http.length + " recurso(s) con HTTP erróneo. Primero: " + http[0].url + " → " + http[0].status);
  return "CAUSA PROBABLE: " + parts.join(" · ");
}

export function formatCacheSummary(s, est) {
  if (!s.supported) return "Cache API no disponible en este contexto.";
  if (s.total === 0) return "Sin entradas de WebLLM/K.ENGINE en caché." + est;
  return (
    s.caches.length +
    " cachés · " +
    s.total +
    " entradas · " +
    s.groups.size +
    " modelo(s)/grupo(s) · tamaño conocido " +
    fmtBytes(s.knownBytes) +
    (s.unknown ? " (" + s.unknown + " entradas sin Content-Length)" : "") +
    est
  );
}

export async function storageEstimateLine() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      return " · uso total del origen ≈ " + fmtBytes(e.usage || 0) + " de " + fmtBytes(e.quota || 0);
    }
  } catch {
    /* no estimate */
  }
  return "";
}
