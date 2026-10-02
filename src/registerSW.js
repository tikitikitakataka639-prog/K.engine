// El Service Worker solo se registra en producción (npm run build / preview): en desarrollo estorbaría al HMR.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("[K.ENGINE] Service Worker no registrado:", e));
  });
}
