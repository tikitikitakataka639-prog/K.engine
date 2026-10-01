"use strict";
// K.ENGINE 1.2 — API de respuesta + servidor estático de la UI. Sin dependencias (Node >= 18).
//
//   KERNEL → HTTP API (este servidor) → backend de inferencia → modelo
//   Backends:  "openai-compatible" (server/inference.js)  ·  "webllm" (pestaña del navegador, server/browser-bridge.js)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import cfg from "./server/config.js";
import persona from "./server/persona.js";
import ctx from "./server/context.js";
import inference from "./server/inference.js";
import bridge from "./server/browser-bridge.js";
import catalog from "./server/catalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const conversations = new Map(); // id -> [{role, content}] (memoria del proceso, tope 200)
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};
const CHAT_KEYS = new Set(["message", "conversation_id", "context", "stream", "backend"]);
const fail = (code, message, errCode) => Object.assign(new Error(message), { code, errCode });

function corsHeaders(req) {
  const o = req.headers.origin;
  if (!o) return {};
  const dev = cfg.env !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  const listed = cfg.corsOrigins.includes(o) || cfg.corsOrigins.includes("*");
  if (!dev && !listed) return {};
  return { "Access-Control-Allow-Origin": o, "Vary": "Origin",
           "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
           "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
}
function send(req, res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(req) });
  res.end(JSON.stringify(obj));
}
function authorized(req) {
  if (!cfg.authToken) return true;
  const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got), b = Buffer.from(cfg.authToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// Cambiar la configuración en caliente: con token, solo con token; sin token, solo desde loopback.
function canConfigure(req) {
  if (cfg.authToken) return authorized(req);
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    let over = false;
    req.on("data", c => { n += c.length; if (over) return; if (n > cfg.maxBodyBytes) { over = true; chunks.length = 0; reject(fail(413, "Cuerpo demasiado grande (máx. " + cfg.maxBodyBytes + " bytes)", "body_too_large")); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
async function readJson(req) {
  let j;
  try { j = JSON.parse((await readBody(req)) || "{}"); }
  catch (e) { if (e.code === 413) throw e; throw fail(400, "JSON inválido", "invalid_json"); }
  if (!j || typeof j !== "object" || Array.isArray(j)) throw fail(400, "El cuerpo debe ser un objeto JSON", "invalid_body");
  return j;
}
const mask = (k) => (!k ? "" : k.length > 8 ? k.slice(0, 3) + "…" + k.slice(-4) : "••••");

/* ---------- /models ---------- */
async function handleModels() {
  const b = bridge.status();
  const models = catalog.WEBLLM_MODELS.map(m => ({
    id: m.id, backend: "webllm",
    status: !b.connected ? "no_browser_connected" : b.loaded === m.id ? (b.state === "READY" ? "ready" : b.state.toLowerCase()) : "not_loaded"
  }));
  const out = { models, backends: { webllm: { browser_connected: b.connected, loaded_model: b.loaded }, "openai-compatible": { configured: inference.configured() } } };
  if (inference.configured()) {
    let check = "unreachable", error;
    try { check = (await inference.listModels()).includes(cfg.model) ? "listed" : "not_listed"; } catch (e) { error = e.message; }
    models.unshift({ id: cfg.model, backend: "openai-compatible", status: "configured", provider_check: check });
    out.backends["openai-compatible"].base_url = cfg.baseUrl;
    if (error) out.backends["openai-compatible"].error = error;
  }
  return out;
}

/* ---------- /chat ---------- */
function parseChat(body) {
  for (const k of Object.keys(body)) if (!CHAT_KEYS.has(k)) throw fail(400, "Campo no permitido: " + k, "unknown_field");
  if (typeof body.message !== "string" || !body.message.trim()) throw fail(400, "'message' debe ser un texto no vacío", "invalid_message");
  if (body.message.length > cfg.maxMessageChars) throw fail(400, "'message' supera el máximo de " + cfg.maxMessageChars + " caracteres", "message_too_long");
  if (body.conversation_id !== undefined && !(typeof body.conversation_id === "string" && /^[\w.-]{1,64}$/.test(body.conversation_id))) throw fail(400, "'conversation_id' inválido (1-64 caracteres: letras, números, _ . -)", "invalid_conversation_id");
  if (body.context !== undefined) {
    if (!Array.isArray(body.context)) throw fail(400, "'context' debe ser un array", "invalid_context");
    if (body.context.length > 200) throw fail(400, "'context' supera 200 mensajes", "invalid_context");
    body.context.forEach((m, i) => {
      if (!m || typeof m !== "object" || !["user", "assistant"].includes(m.role) || typeof m.content !== "string")
        throw fail(400, "context[" + i + "] debe ser {role: 'user'|'assistant', content: string}", "invalid_context");
    });
  }
  if (body.stream !== undefined && typeof body.stream !== "boolean") throw fail(400, "'stream' debe ser booleano", "invalid_stream");
  if (body.backend !== undefined && !["webllm", "openai-compatible"].includes(body.backend)) throw fail(400, "'backend' debe ser 'webllm' u 'openai-compatible'", "invalid_backend");
  return body;
}
function pickBackend(requested) {
  const want = requested || cfg.defaultBackend;
  if (want === "openai-compatible") { if (!inference.configured()) throw fail(503, "Backend openai-compatible sin configurar: define KENGINE_BASE_URL y KENGINE_MODEL", "backend_not_configured"); return want; }
  if (want === "webllm") return want; // el bridge informa si no hay modelo listo
  if (inference.configured()) return "openai-compatible";
  if (bridge.available()) return "webllm";
  throw fail(503, "Ningún backend disponible: configura KENGINE_BASE_URL/KENGINE_MODEL o abre la UI de K.ENGINE y carga un modelo WebLLM", "no_backend");
}
async function runBackend(backend, messages, onDelta, signal, streaming = true) {
  if (backend === "webllm") { const r = await bridge.run(messages, onDelta, signal); return { text: r.text, model: r.model, streamed: true }; }
  if (!streaming) return { text: await inference.complete(messages, signal), model: cfg.model, streamed: false }; // modo no-streaming original
  const r = await inference.stream(messages, onDelta, signal);
  return { text: r.text, model: cfg.model, streamed: r.streamed };
}
function prepare(b) {
  const id = b.conversation_id || crypto.randomUUID();
  const message = b.message.trim();
  const history = Array.isArray(b.context) && b.context.length ? b.context : (conversations.get(id) || []);
  const built = ctx.build(history, message, persona.systemPrompt.length);
  return { id, built, messages: [{ role: "system", content: persona.systemPrompt }, ...built.messages] };
}
function remember(id, built, answer) {
  conversations.delete(id); conversations.set(id, [...built.messages, { role: "assistant", content: answer }].slice(-cfg.contextMaxMessages));
  if (conversations.size > 200) conversations.delete(conversations.keys().next().value);
}

async function handleChat(req, res) {
  const body = parseChat(await readJson(req));
  const backend = pickBackend(body.backend);
  const p = prepare(body);
  const meta = (model) => ({ model, backend, conversation_id: p.id, context: { used_messages: p.built.messages.length, dropped_messages: p.built.dropped } });
  const wantsStream = body.stream === true || /text\/event-stream/.test(req.headers.accept || "");
  const ac = new AbortController();
  res.on("close", () => { if (!res.writableEnded) ac.abort(); });

  if (!wantsStream) {
    const r = await runBackend(backend, p.messages, () => {}, ac.signal, false);
    remember(p.id, p.built, r.text);
    return send(req, res, 200, { response: r.text, ...meta(r.model) });
  }
  // SSE: event meta → data {delta}... → event done {response,...} | event error
  res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no", ...corsHeaders(req) });
  const ev = (name, obj) => res.write("event: " + name + "\ndata: " + JSON.stringify(obj) + "\n\n");
  ev("meta", { backend, conversation_id: p.id });
  try {
    const r = await runBackend(backend, p.messages, (d) => ev("delta", { delta: d }), ac.signal);
    remember(p.id, p.built, r.text);
    ev("done", { response: r.text, streamed: r.streamed, ...meta(r.model) });
  } catch (e) { ev("error", { error: e.message, code: e.errCode || "backend_error" }); }
  res.end();
}

/* ---------- /config (runtime, en memoria; no se persiste a disco) ---------- */
const configView = () => ({ backend: cfg.defaultBackend, base_url: cfg.baseUrl, api_key: mask(cfg.apiKey), api_key_set: Boolean(cfg.apiKey), model: cfg.model,
  auth_required: Boolean(cfg.authToken), env: cfg.env, persisted: false });
async function handleConfigPost(req) {
  const b = await readJson(req);
  for (const k of Object.keys(b)) if (!["backend", "base_url", "api_key", "model"].includes(k)) throw fail(400, "Campo no permitido: " + k, "unknown_field");
  if (b.backend !== undefined && !["auto", "webllm", "openai-compatible"].includes(b.backend)) throw fail(400, "backend inválido", "invalid_backend");
  if (b.base_url !== undefined) { if (typeof b.base_url !== "string" || (b.base_url && !/^https?:\/\/[^\s]+$/.test(b.base_url))) throw fail(400, "base_url debe ser http(s)://…", "invalid_base_url"); }
  for (const k of ["api_key", "model"]) if (b[k] !== undefined && (typeof b[k] !== "string" || b[k].length > 512)) throw fail(400, k + " inválido", "invalid_" + k);
  if (b.backend !== undefined) cfg.defaultBackend = b.backend;
  if (b.base_url !== undefined) cfg.baseUrl = b.base_url.replace(/\/+$/, "");
  if (b.api_key) cfg.apiKey = b.api_key;           // vacío/omitido = conservar la actual
  if (b.model !== undefined) cfg.model = b.model;
  return configView();
}

function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
}
function isInside(root, file) {
  const rel = path.relative(root, file);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}
function sendFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("No encontrado"); }
    const ext = path.extname(file).toLowerCase();
    const cache = ext && ext !== ".html" && file.includes(`${path.sep}assets${path.sep}`)
      ? "public, max-age=31536000, immutable"
      : "no-store";
    res.writeHead(200, { "Content-Type": mimeFor(file), "Cache-Control": cache });
    res.end(data);
  });
}
function serveStatic(req, res) {
  let rel;
  try { rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html"; }
  catch { rel = ""; }
  if (!rel || rel.includes("\0") || rel.split(/[/\\]/).includes("..")) {
    res.writeHead(404); return res.end("No encontrado");
  }
  const dist = path.join(__dirname, "dist");
  const pub = path.join(__dirname, "public");
  const candidates = [
    path.join(dist, rel),
    path.join(pub, rel),
  ];
  if (rel === "README.md") candidates.push(path.join(__dirname, "README.md"));
  if (!path.extname(rel) || rel === "index.html") candidates.push(path.join(dist, "index.html"));

  const tryAt = (i) => {
    if (i >= candidates.length) { res.writeHead(404); return res.end("No encontrado"); }
    const file = candidates[i];
    const allowed = isInside(dist, file) || isInside(pub, file) || file === path.join(__dirname, "README.md");
    if (!allowed) return tryAt(i + 1);
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return tryAt(i + 1);
      sendFile(res, file);
    });
  };
  tryAt(0);
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  try {
    if (req.method === "OPTIONS") { res.writeHead(204, corsHeaders(req)); return res.end(); }
    if (req.method === "GET" && url === "/health") return send(req, res, 200, { status: "ok", engine: "K.ENGINE", version: cfg.version });
    if (["/models", "/chat", "/config", "/bridge/events", "/bridge/state", "/bridge/chunk"].includes(url)) {
      if (!authorized(req)) return send(req, res, 401, { error: "No autorizado", code: "unauthorized" });
      if (req.method === "GET" && url === "/models") return send(req, res, 200, await handleModels());
      if (req.method === "POST" && url === "/chat") return await handleChat(req, res);
      if (url === "/config") {
        if (!canConfigure(req)) return send(req, res, 403, { error: "Configuración remota no permitida sin KENGINE_AUTH_TOKEN", code: "forbidden" });
        if (req.method === "GET") return send(req, res, 200, configView());
        if (req.method === "POST") return send(req, res, 200, await handleConfigPost(req));
      }
      if (req.method === "GET" && url === "/bridge/events") return bridge.attach(req, res);
      if (req.method === "POST" && url === "/bridge/state") { bridge.setState(await readJson(req)); return send(req, res, 200, { ok: true }); }
      if (req.method === "POST" && url === "/bridge/chunk") { bridge.chunk(await readJson(req)); return send(req, res, 200, { ok: true }); }
      return send(req, res, 405, { error: "Método no permitido" });
    }
    if (req.method === "GET" && cfg.serveStatic) return serveStatic(req, res);
    send(req, res, 404, { error: "No encontrado" });
  } catch (e) {
    const code = Number.isInteger(e.code) ? e.code : 502;
    if (res.headersSent) return res.end();
    if (code === 413) res.setHeader("Connection", "close"); // se descarta el resto del cuerpo y se cierra
    send(req, res, code, { error: e.message, code: e.errCode || "error" });
  }
});

function isMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  try { return import.meta.url === pathToFileURL(path.resolve(entry)).href; }
  catch { return false; }
}
if (isMain()) {
  cfg.validate();
  server.listen(cfg.port, cfg.host, () => console.log("K.ENGINE " + cfg.version + " en http://" + cfg.host + ":" + cfg.port + " [" + cfg.env + "]"));
}
export default server;
