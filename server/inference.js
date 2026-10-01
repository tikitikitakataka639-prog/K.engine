"use strict";
// BACKEND "openai-compatible": cliente de cualquier endpoint compatible con OpenAI
// (Ollama, LM Studio, vLLM, llama.cpp...). Aislado del resto. Lee cfg en cada llamada,
// así que los cambios en caliente de POST /config se aplican sin reiniciar.
import cfg from "./config.js";

function configured() { return Boolean(cfg.baseUrl && cfg.model); }
function headers() {
  const h = { "Content-Type": "application/json" };
  if (cfg.apiKey) h.Authorization = "Bearer " + cfg.apiKey;
  return h;
}
async function call(path, init, signal) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), cfg.timeoutMs);
  if (signal) signal.addEventListener("abort", () => ctl.abort(), { once: true });
  try { return await fetch(cfg.baseUrl + path, { ...init, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

async function listModels() {
  const r = await call("/models", { headers: headers() });
  if (!r.ok) throw new Error("El proveedor respondió HTTP " + r.status + " en /models");
  const j = await r.json();
  return (j.data || j.models || []).map(m => m.id || m.name).filter(Boolean);
}

function body(messages, stream) {
  return JSON.stringify({ model: cfg.model, messages, stream, max_tokens: cfg.maxTokens });
}
function extract(j) {
  const c = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if (typeof c !== "string") throw new Error("Respuesta del proveedor sin choices[0].message.content");
  return c;
}

async function complete(messages, signal) {
  const r = await call("/chat/completions", { method: "POST", headers: headers(), body: body(messages, false) }, signal);
  const text = await r.text();
  if (!r.ok) throw new Error("El proveedor respondió HTTP " + r.status + ": " + text.slice(0, 300));
  let j; try { j = JSON.parse(text); } catch { throw new Error("Respuesta del proveedor no es JSON válido"); }
  return extract(j);
}

// Streaming SSE del proveedor. Si el proveedor ignora stream:true y devuelve JSON completo,
// se entrega como un único delta (fallback a respuesta completa). Devuelve { text, streamed }.
async function stream(messages, onDelta, signal) {
  const r = await call("/chat/completions", { method: "POST", headers: headers(), body: body(messages, true) }, signal);
  if (!r.ok) throw new Error("El proveedor respondió HTTP " + r.status + ": " + (await r.text()).slice(0, 300));
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("text/event-stream")) {
    const text = extract(await r.json());
    onDelta(text);
    return { text, streamed: false };
  }
  const dec = new TextDecoder(); let buf = "", full = "";
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let j; try { j = JSON.parse(data); } catch { continue; }
      const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
      if (d) { full += d; onDelta(d); }
    }
  }
  return { text: full, streamed: true };
}
export { configured, listModels, complete, stream };
export default { configured, listModels, complete, stream };
