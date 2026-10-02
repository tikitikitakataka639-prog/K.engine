// Service Worker de la APLICACIÓN (PWA). No participa en la inferencia ni en la caché de modelos.
// - Solo cachea el "app shell" (HTML/JS/CSS/fuentes del mismo origen) en la caché `kengine-app-*`.
// - Nunca intercepta peticiones de otros orígenes (Hugging Face, GitHub raw, etc.): los modelos de WebLLM
//   viajan por su propia Cache API (`webllm/*`) y este worker ni las toca.
// - Nunca cachea /health /models /chat /config /bridge (API de K.ENGINE).
const APP_CACHE = "kengine-app-v1";
const API = /^\/(health|models|chat|config|bridge)(\/|$)/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("kengine-app-") && name !== APP_CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || API.test(url.pathname)) return;
  if (req.headers.has("range")) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      try {
        const res = await fetch(req); // red primero: el desarrollo y las actualizaciones siempre ganan
        if (res.ok && res.type === "basic") cache.put(req, res.clone());
        return res;
      } catch {
        const hit = (await cache.match(req)) || (req.mode === "navigate" ? await cache.match("/") : undefined);
        if (hit) return hit;
        throw new Error("Sin red y sin copia en caché de la aplicación");
      }
    })(),
  );
});
