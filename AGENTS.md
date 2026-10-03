# K.ENGINE — notas para agentes y desarrolladores

Proyecto: React 19 + Vite + WebLLM/WebGPU (UI) y `server.js` (API Node sin dependencias). Sin backend de inferencia propio:
la inferencia corre en el navegador del usuario. Sin auth, sin base de datos, sin dependencias de plataformas externas.

## Arquitectura (no sustituir)
`main.jsx → EngineProvider → ModelManager → Web Worker (kengine-worker.js) → @mlc-ai/web-llm → WebGPU`
- `src/engine/modelManager.js`: ÚNICA fuente de verdad del estado de los modelos (descargar, cargar, liberar, formatear). Los componentes solo leen/llaman.
- `src/engine/models.js`: catálogo derivado de `prebuiltAppConfig.model_list` + metadatos (descripción, capacidades, prioridad) + `autoSelectModel()`.
- `src/engine/hardware.js`: detección WebGPU + clasificación RECOMENDADO/POSIBLE/PESADO/NO COMPATIBLE (el navegador no expone la VRAM: es estimación).
- `src/engine/storage.js`: IndexedDB (URL de KERNEL, VRAM declarada, modelo elegido, historial del laboratorio).
- `src/engine/errors.js`: clasificación de errores tipados (KEngineError) con mensajes en español. Usado por ModelManager y kengineApi.
- `src/engine/kengineApi.js`: API interna para KERNEL (`initialize`, `loadModel`, `unloadModel`, `generate`, `stream`, `cancel`, `getStatus`, `getCapabilities`, `clearModelCache`, `selectBestModel`, `getPersonality`). Encapsula WebLLM/WebGPU. KERNEL no toca ModelManager directamente.
- `src/engine/personality.js`: personalidad de KERNEL centralizada (system prompt). Una sola fuente, compartida con `server/persona.js`.
- `public/sw.js`: Service Worker SOLO de la app (producción). No toca la caché de modelos (`webllm/*`) ni orígenes externos.

## Recuperación de caché corrupta
El worker (`kengine-worker.js`) detecta errores de Cache API (`Cache.add`, `network error`, `internal error`) durante `CreateMLCEngine`.
Si detecta un error de caché: limpia solo las entradas de ese modelo en `webllm/model` (función `cleanModelCacheInWorker`) y reintenta una vez.
Si falla de nuevo, reporta el error original. No borra otras cachés, ni IndexedDB, ni localStorage.

## Selección automática
`autoSelectModel(hw, catalog, manual)` en `models.js` elige el mejor modelo compatible: filtra por INCOMPATIBLE, ordena por RECOMENDADO > POSIBLE > PESADO, y desempata por prioridad.
Se llama automáticamente al iniciar el motor (`EngineProvider.startEngine`) y está expuesta en `kengineApi.selectBestModel()`.

## Estados de modelo
CHECKING · NOT_DOWNLOADED · DOWNLOADED · DOWNLOADING · LOADING · VERIFYING · READY · GENERATING · CANCELLING · UNLOADING · DELETING · ERROR · INCOMPATIBLE

## Quirks que ya costaron tiempo
- WebLLM no separa descarga y carga en GPU: `CreateMLCEngine` hace ambas. El % mostrado es el de `initProgressCallback`.
- `deleteModelAllInfoInCache` (0.2.79) llama a `deleteNDArrayCache` sin `await` y deja `ndarray-cache.json`; ModelManager espera y limpia ese índice.
- Cache API y WebGPU exigen contexto seguro (`https://` o `localhost`). En `http://<host>` no hay `caches`.
- Un servicio de Docker llamado `app` rompe Chromium (`.app` es TLD con HSTS): el servicio se llama `kengine`.

## Comandos
`npm install` · `npm run dev` (UI :8080 + API :5173) · `npm run build` · `npm run preview` (:4173) · `npm test` (API, simulada) · `npm run test:e2e`
En este entorno: `docker compose -f docker-compose.base44.yml up -d` (UI en :3000) y `docker compose -f docker-compose.base44.yml run --rm e2e`
(`E2E_REAL_MODEL=1` activa el test que descarga un modelo real; necesita GPU con `shader-f16`).
