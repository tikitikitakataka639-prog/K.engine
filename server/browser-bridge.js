"use strict";
// BACKEND "webllm": la inferencia ocurre en la pestaña K.ENGINE abierta en el navegador
// (WebLLM + WebGPU). El servidor NO ejecuta el modelo: reenvía los trabajos a esa pestaña.
// Protocolo:  GET /bridge/events (SSE: job)  ·  POST /bridge/state  ·  POST /bridge/chunk
import crypto from "node:crypto";
import cfg from "./config.js";
import catalog from "./catalog.js";

let active = null;                 // { id, res, loadedWebllmId, state, hb }
const jobs = new Map();            // jobId -> { onDelta, resolve, reject, timer }
let chain = Promise.resolve();     // un solo motor: trabajos en serie

function attach(req, res) {
  if (active) { try { active.res.end(); } catch {} clearInterval(active.hb); failAll("Otra pestaña K.ENGINE tomó el control del bridge"); }
  const client = { id: crypto.randomUUID(), res, loadedWebllmId: null, state: "NOT_LOADED" };
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "Connection": "keep-alive" });
  res.write("event: hello\ndata: " + JSON.stringify({ client_id: client.id }) + "\n\n");
  client.hb = setInterval(() => res.write(": hb\n\n"), 15000);
  active = client;
  req.on("close", () => { clearInterval(client.hb); if (active === client) { active = null; failAll("La pestaña K.ENGINE se desconectó"); } });
}
function failAll(msg) { for (const [id, j] of jobs) { clearTimeout(j.timer); j.reject(new Error(msg)); jobs.delete(id); } }

function setState(b) {
  if (!active || b.client_id !== active.id) throw Object.assign(new Error("client_id desconocido"), { code: 409 });
  active.state = typeof b.state === "string" ? b.state.slice(0, 32) : active.state;
  active.loadedWebllmId = typeof b.loaded_model === "string" ? b.loaded_model : null;
}
function chunk(b) {
  if (!active || b.client_id !== active.id) throw Object.assign(new Error("client_id desconocido"), { code: 409 });
  const j = jobs.get(b.job_id);
  if (!j) return; // trabajo ya cerrado (timeout/cancelado)
  clearTimeout(j.timer); j.timer = setTimeout(() => j.reject(new Error("Timeout esperando a la pestaña K.ENGINE")), cfg.timeoutMs);
  if (typeof b.delta === "string" && b.delta) j.onDelta(b.delta);
  if (b.error) { clearTimeout(j.timer); jobs.delete(b.job_id); j.reject(new Error(String(b.error).slice(0, 500))); }
  else if (b.done) { clearTimeout(j.timer); jobs.delete(b.job_id); j.resolve(); }
}

function status() {
  if (!active) return { connected: false, loaded: null, state: null };
  const m = active.loadedWebllmId ? catalog.byWebllmId(active.loadedWebllmId) : null;
  return { connected: true, loaded: active.loadedWebllmId ? (m ? m.id : active.loadedWebllmId) : null, state: active.state };
}
function available() { const s = status(); return s.connected && s.loaded && s.state === "READY"; }

function run(messages, onDelta, signal) {
  const task = chain.then(() => new Promise((resolve, reject) => {
    if (!available()) return reject(Object.assign(new Error(
      active ? "La pestaña K.ENGINE está conectada pero no tiene ningún modelo WebLLM en estado READY"
             : "No hay ninguna pestaña K.ENGINE conectada (abre la UI y carga un modelo)"), { code: 503 }));
    const id = crypto.randomUUID(); let text = "";
    const job = { onDelta: (d) => { text += d; onDelta(d); }, resolve: () => resolve({ text, model: status().loaded }), reject,
                  timer: setTimeout(() => reject(new Error("Timeout esperando a la pestaña K.ENGINE")), cfg.timeoutMs) };
    jobs.set(id, job);
    if (signal) signal.addEventListener("abort", () => { jobs.delete(id); clearTimeout(job.timer); reject(new Error("Cancelado")); try { active && active.res.write("event: cancel\ndata: " + JSON.stringify({ job_id: id }) + "\n\n"); } catch {} }, { once: true });
    active.res.write("event: job\ndata: " + JSON.stringify({ job_id: id, messages, max_tokens: cfg.maxTokens }) + "\n\n");
  }));
  chain = task.catch(() => {});
  return task;
}
export { attach, setState, chunk, status, available, run };
export default { attach, setState, chunk, status, available, run };
