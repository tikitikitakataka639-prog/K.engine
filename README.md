# K.ENGINE 1.3.0

Motor de respuesta independiente para KERNEL. Inferencia **100% local en el navegador** (WebLLM + WebGPU); KERNEL solo habla con la API HTTP.

```
main → EngineProvider → ModelManager → Web Worker → @mlc-ai/web-llm → WebGPU → modelo local
```

Flujo de uso: **INICIAR MOTOR** → *INTRODUCIR URL DE K.E.R.N.E.L* (opcional, solo se guarda en tu navegador) → detección WebGPU → catálogo (derivado de `prebuiltAppConfig.model_list`) → **DESCARGAR** (% real) → READY → laboratorio con la personalidad de KERNEL → **LIBERAR MEMORIA** (conserva los datos) / **FORMATEAR MODELO** (borra los datos de ese modelo, con confirmación).

Requisitos del navegador: WebGPU (Chrome/Edge 113+), contexto seguro (`https://` o `localhost`), `shader-f16` para los modelos q4f16. Los pesos se descargan de Hugging Face (y la librería WASM de GitHub) la primera vez; la inferencia nunca sale del equipo.

```
K.ENGINE
├── index.html · src/ · public/         UI React + Vite (engine/: ModelManager, hardware, storage; webllm/: worker)
├── vite.config.ts                      dev :8080, preview :4173, proxy a la API
├── server.js · server/                 API /health /models /chat /config /bridge (+ sirve dist/ con `npm start`)
└── tests/                              server.test.js (API simulada) · e2e/ (Playwright, Chromium real)
```

## Instalación y arranque

Node ≥ 20.

```bash
npm install
```

### Desarrollo (recomendado)

Arranca Vite (UI) y `server.js` (API) juntos. Vite proxifica `/health`, `/models`, `/chat`, `/config` y `/bridge` al motor.

```bash
npm run dev
```

Comandos separados si hace falta:

```bash
npm run dev:server    # node server.js  (API, por defecto http://127.0.0.1:5173)
npm run dev:client    # Vite (UI)
```

`npm start` no se ha sustituido: sigue siendo `node server.js`.

Variables típicas para el backend openai-compatible:

```bash
export KENGINE_BASE_URL=http://127.0.0.1:11434/v1
export KENGINE_API_KEY=ollama
export KENGINE_MODEL=qwen3:4b
node server.js
```

Sin proveedor configurado también arranca: usa solo el backend WebLLM (abre la UI y carga un modelo).

### Producción

```bash
npm run build
npm start
```

`server.js` sirve `dist/` (la UI de React) junto a la API. `npm run preview` sirve el build en :4173 (con proxy a la API si `server.js` está en marcha).

**Producción:** `KENGINE_ENV=production` exige `KENGINE_AUTH_TOKEN`; `KENGINE_HOST` distinto de localhost también. Pon HTTPS delante (proxy inverso). WebGPU/Cache API de la UI requieren contexto seguro (https o localhost).

## API

`GET /health` → `{"status":"ok","engine":"K.ENGINE","version":"1.2.0"}`

`GET /models` (con token si se exige):
```json
{"models":[
  {"id":"qwen3:4b","backend":"openai-compatible","status":"configured","provider_check":"listed"},
  {"id":"llama-3.2-1b","backend":"webllm","status":"ready"}],
 "backends":{"webllm":{"browser_connected":true,"loaded_model":"llama-3.2-1b"},"openai-compatible":{"configured":true,"base_url":"…"}}}
```

Estados WebLLM reales: `ready` (la pestaña lo reportó READY), `not_loaded`, `no_browser_connected`. `configured` (remoto) no implica que esté cargado en memoria; `provider_check` dice si el proveedor lo lista (`listed`/`not_listed`/`unreachable`).

`POST /chat`
```bash
curl -X POST http://127.0.0.1:5173/chat -H "Content-Type: application/json" \
  -d '{"message":"Abre Minecraft","conversation_id":"kernel-001"}'
```

Campos admitidos: `message` (obligatorio), `conversation_id`, `context` (`[{role:"user"|"assistant",content}]`), `stream` (bool), `backend` (`webllm`|`openai-compatible`). Cualquier otro campo → 400. Sin `context`, se usa el historial guardado en memoria del servidor para ese `conversation_id` (se pierde al reiniciar).

**Streaming:** `stream:true` o `Accept: text/event-stream`. Eventos: `meta` → `delta` (`{"delta":"…"}`)… → `done` (`{response, model, backend, conversation_id, streamed}`) | `error`. Sin lo anterior, respuesta JSON completa como antes.

`GET/POST /config`: backend/base_url/model/api_key en caliente (la key se devuelve enmascarada, solo en memoria; sin token solo desde localhost).

K.ENGINE **solo devuelve texto**: `/chat` nunca ejecuta comandos ni herramientas (`server/tools.js` es un punto de extensión vacío). Errores: `{"error":"…","code":"…"}`.

## Variables de entorno

Ver `.env.example`. Principales: `KENGINE_BASE_URL`, `KENGINE_API_KEY`, `KENGINE_MODEL`, `KENGINE_BACKEND`, `KENGINE_AUTH_TOKEN`, `KENGINE_CORS_ORIGIN`, límites de cuerpo/mensaje/contexto.

## CORS

`KENGINE_CORS_ORIGIN=https://kernel.example.com` (lista separada por comas). En desarrollo se permite localhost automáticamente. `*` solo es válido en desarrollo y de forma explícita. El bridge del navegador (`/bridge/*`) está pensado para la misma origen que sirve la UI.

## Contexto y personalidad

`server/context.js`: se envía siempre el prompt de sistema y el mensaje actual; se descartan primero los mensajes más antiguos hasta cumplir límites de nº de mensajes y caracteres (aprox., no hay tokenizador). No resume ni inventa. La personalidad vive en `server/persona.js` (UI: `src/engine/personality.js`, mismo texto).

## WebLLM en el navegador

Worker con `@mlc-ai/web-llm@0.2.79`; los IDs se validan contra `prebuiltAppConfig.model_list` (catálogo del servidor: `server/catalog.js`; la UI deriva su catálogo directamente de WebLLM en `src/engine/models.js`). Panel **Control** de la UI: estado real, compatibilidad de modelos según WebGPU/`shader-f16`, backend y diagnóstico de caché.

Modelo prioritario: `mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC` (ID de API `llama-3.2-1b`, ID WebLLM `Llama-3.2-1B-Instruct-q4f16_1-MLC`).

**Caché:** *Eliminar caché de modelos* borra solo cachés `webllm*`/`kengine*`, con progreso real (por bytes si todas las entradas tienen `Content-Length`; si no, por nº de entradas, y lo indica). No muestra 100 % hasta re-escanear y comprobar que no quedan entradas. Se rechaza con un modelo cargado.

**Error `Cache.add() network error`:** *Diagnosticar recursos* prueba la Cache API (put/match/delete), el almacenamiento y sondea desde el worker el wasm, config, tokenizer y cada shard (`fetch` + `Range`), mostrando URL, estado HTTP/redirección o el error de fetch, más las últimas peticiones de Resource Timing. *Limpiar entradas corruptas y reintentar* borra solo entradas cacheadas no-OK del modelo seleccionado y reintenta **una** vez.

## Pruebas

```bash
npm test                  # servidor con proveedor y navegador simulados
npm run build && python3 tests/ui.test.py   # UI en Chromium headless (Playwright)
```

## Limitaciones reales

- No se afirma que el error `Cache.add() encountered a network error` esté solucionado: el diagnóstico se conserva; la causa real sigue sin determinar hasta ejecutarlo en un navegador con WebGPU y red.
- El backend `webllm` vía API requiere la pestaña abierta; un único modelo y un trabajo a la vez. Las respuestas de la API aparecen también en el chat de la UI.
- VRAM/RAM: el navegador no las expone con fiabilidad; solo se usan WebGPU, `shader-f16`, `deviceMemory` (si existe) y el requisito de WebLLM. La recomendación no descarga nada.
- Historial por `conversation_id` en memoria (máx. 200 conversaciones). Configuración en caliente no se persiste.
- Los límites de contexto de la UI de chat (últimos 12 mensajes) no se han unificado con los del servidor.
- WebGPU/WebLLM requieren un navegador real (Chrome/Edge 113+). En headless o sin GPU no se puede completar la carga del modelo.
