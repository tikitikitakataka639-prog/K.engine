# K.ENGINE — notas para agentes y desarrolladores

Proyecto: React 19 + Vite + WebLLM/WebGPU (UI) y `server.js` (API Node sin dependencias). Sin backend de inferencia propio:
la inferencia corre en el navegador del usuario. Sin auth, sin base de datos, sin dependencias de plataformas externas.

## Arquitectura (no sustituir)
`main.jsx → EngineProvider → ModelManager → Web Worker (kengine-worker.js) → @mlc-ai/web-llm → WebGPU`
- `src/engine/modelManager.js`: ÚNICA fuente de verdad del estado de los modelos (descargar, cargar, liberar, formatear). Los componentes solo leen/llaman.
- `src/engine/models.js`: catálogo derivado de `prebuiltAppConfig.model_list`. Solo hay una lista de IDs "destacados", validada contra la real.
- `src/engine/hardware.js`: detección WebGPU + clasificación RECOMENDADO/POSIBLE/PESADO/NO COMPATIBLE (el navegador no expone la VRAM: es estimación).
- `src/engine/storage.js`: IndexedDB (URL de KERNEL, VRAM declarada, modelo elegido, historial del laboratorio).
- `public/sw.js`: Service Worker SOLO de la app (producción). No toca la caché de modelos (`webllm/*`) ni orígenes externos.

## Quirks que ya costaron tiempo
- WebLLM no separa descarga y carga en GPU: `CreateMLCEngine` hace ambas. El % mostrado es el de `initProgressCallback`.
- `deleteModelAllInfoInCache` (0.2.79) llama a `deleteNDArrayCache` sin `await` y deja `ndarray-cache.json`; ModelManager espera y limpia ese índice.
- Cache API y WebGPU exigen contexto seguro (`https://` o `localhost`). En `http://<host>` no hay `caches`.
- Un servicio de Docker llamado `app` rompe Chromium (`.app` es TLD con HSTS): el servicio se llama `kengine`.

## Comandos
`npm install` · `npm run dev` (UI :8080 + API :5173) · `npm run build` · `npm run preview` (:4173) · `npm test` (API, simulada) · `npm run test:e2e`
En este entorno: `docker compose -f docker-compose.base44.yml up -d` (UI en :3000) y `docker compose -f docker-compose.base44.yml run --rm e2e`
(`E2E_REAL_MODEL=1` activa el test que descarga un modelo real; necesita GPU con `shader-f16`).
