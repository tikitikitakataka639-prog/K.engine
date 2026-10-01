"use strict";
// Pruebas del servidor con un proveedor OpenAI-compatible SIMULADO y una pestaña de navegador SIMULADA.
// No prueban WebLLM/WebGPU reales.
import http from "node:http";
import assert from "node:assert";

const up = http.createServer((q, r) => {
  let b = ""; q.on("data", c => b += c);
  q.on("end", () => {
    if (q.url === "/v1/models") { r.setHeader("Content-Type", "application/json"); return r.end(JSON.stringify({ data: [{ id: "mock" }] })); }
    const j = JSON.parse(b);
    if (j.stream) {
      r.writeHead(200, { "Content-Type": "text/event-stream" });
      for (const w of ["Ho", "la", "."]) r.write("data: " + JSON.stringify({ choices: [{ delta: { content: w } }] }) + "\n\n");
      return r.end("data: [DONE]\n\n");
    }
    r.setHeader("Content-Type", "application/json");
    r.end(JSON.stringify({ choices: [{ message: { content: "eco:" + j.messages.length + ":" + j.messages[0].role } }] }));
  });
});
const results = []; const ok = (n) => { results.push("OK   " + n); };
up.listen(5999, "127.0.0.1", async () => {
  process.env.KENGINE_BASE_URL = "http://127.0.0.1:5999/v1"; process.env.KENGINE_MODEL = "mock";
  process.env.KENGINE_MAX_MESSAGE_CHARS = "50"; process.env.KENGINE_MAX_BODY_BYTES = "2000";
  const { default: server } = await import("../server.js");
  const { default: cfg } = await import("../server/config.js");
  const ctx = (await import("../server/context.js")).default;
  server.listen(5998, "127.0.0.1", async () => {
    const B = "http://127.0.0.1:5998";
    const g = async (p, o) => { const r = await fetch(B + p, o); return { s: r.status, t: await r.text(), h: r.headers }; };
    const post = (p, b, h = {}) => g(p, { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: typeof b === "string" ? b : JSON.stringify(b) });
    try {
      let r = await g("/health"); assert.deepStrictEqual(JSON.parse(r.t), { status: "ok", engine: "K.ENGINE", version: "1.2.0" }); ok("GET /health");
      r = await g("/models"); let j = JSON.parse(r.t);
      assert(j.models.find(m => m.id === "mock" && m.backend === "openai-compatible" && m.status === "configured" && m.provider_check === "listed"));
      assert(j.models.filter(m => m.backend === "webllm").every(m => m.status === "no_browser_connected")); ok("GET /models (webllm NO se marca ready sin navegador)");
      r = await post("/chat", { message: "Hola", conversation_id: "abc123", context: [] }); j = JSON.parse(r.t);
      assert(r.s === 200 && j.response === "eco:2:system" && j.backend === "openai-compatible" && j.model === "mock" && j.conversation_id === "abc123"); ok("POST /chat no-streaming");
      r = await post("/chat", { message: "Hola", stream: true });
      assert(r.s === 200 && /event: meta/.test(r.t) && (r.t.match(/event: delta/g) || []).length === 3 && /event: done/.test(r.t) && /"response":"Hola\."/.test(r.t)); ok("POST /chat SSE (stream:true) con streaming real del proveedor");
      r = await post("/chat", { message: "Hola" }, { Accept: "text/event-stream" }); assert(/event: done/.test(r.t)); ok("POST /chat SSE (Accept: text/event-stream)");
      for (const [n, b, code] of [["mensaje vacío", { message: "  " }, "invalid_message"], ["mensaje demasiado largo", { message: "x".repeat(51) }, "message_too_long"],
        ["conversation_id inválido", { message: "a", conversation_id: "a b/c" }, "invalid_conversation_id"], ["campo desconocido", { message: "a", cmd: "dir" }, "unknown_field"],
        ["context con rol system", { message: "a", context: [{ role: "system", content: "x" }] }, "invalid_context"], ["backend inválido", { message: "a", backend: "x" }, "invalid_backend"]]) {
        r = await post("/chat", b); assert(r.s === 400 && JSON.parse(r.t).code === code, n + " → " + r.t); ok("validación: " + n);
      }
      r = await post("/chat", "{no json"); assert(r.s === 400 && JSON.parse(r.t).code === "invalid_json"); ok("validación: JSON inválido");
      r = await post("/chat", "[1]"); assert(r.s === 400); ok("validación: cuerpo no objeto");
      r = await post("/chat", JSON.stringify({ message: "a", context: [{ role: "user", content: "x".repeat(3000) }] })); assert(r.s === 413); ok("límite de tamaño de petición (413)");
      r = await post("/chat", { message: "a", backend: "webllm" }); assert(r.s === 502 || r.s === 503); ok("backend webllm sin navegador → error claro: " + JSON.parse(r.t).error.slice(0, 40) + "…");
      // Contexto: poda conserva el mensaje actual
      const big = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "m" + i }));
      const built = ctx.build(big, "ACTUAL", 100); assert(built.messages.at(-1).content === "ACTUAL" && built.messages.length <= cfg.contextMaxMessages && built.dropped > 0 && built.messages[0].role === "user"); ok("contexto: poda antiguos, conserva mensaje actual");
      // Bridge simulado
      const ev = await fetch(B + "/bridge/events"); const rd = ev.body.getReader(); const dec = new TextDecoder(); let buf = "";
      const next = async (re) => { while (!re.test(buf)) { const { value, done } = await rd.read(); if (done) throw new Error("fin"); buf += dec.decode(value); } };
      await next(/client_id/); const cid = /"client_id":"([^"]+)"/.exec(buf)[1];
      r = await g("/models"); assert(JSON.parse(r.t).models.filter(m => m.backend === "webllm").every(m => m.status === "not_loaded")); ok("bridge: navegador conectado sin modelo → not_loaded");
      r = await post("/chat", { message: "a", backend: "webllm" }); assert(r.s === 503); ok("bridge: sin modelo READY → 503");
      await post("/bridge/state", { client_id: cid, loaded_model: "Llama-3.2-1B-Instruct-q4f16_1-MLC", state: "READY" });
      assert(JSON.parse((await g("/models")).t).models.find(m => m.id === "llama-3.2-1b").status === "ready"); ok("bridge: modelo READY reportado por el navegador → ready");
      const chat = post("/chat", { message: "Hola navegador", backend: "webllm", conversation_id: "kernel-001" });
      await next(/event: job/); const jid = /"job_id":"([^"]+)"/.exec(buf)[1];
      await post("/bridge/chunk", { client_id: cid, job_id: jid, delta: "Hola" }); await post("/bridge/chunk", { client_id: cid, job_id: jid, delta: "." }); await post("/bridge/chunk", { client_id: cid, job_id: jid, done: true });
      r = await chat; j = JSON.parse(r.t); assert(r.s === 200 && j.response === "Hola." && j.backend === "webllm" && j.model === "llama-3.2-1b" && j.conversation_id === "kernel-001"); ok("bridge: /chat vía webllm (navegador SIMULADO)");
      // Config
      r = await post("/config", { api_key: "sk-secreto-1234567" }); j = JSON.parse(r.t); assert(j.api_key === "sk-…4567" && !r.t.includes("secreto")); ok("config: API key enmascarada");
      r = await post("/config", { base_url: "ftp://x" }); assert(r.s === 400); ok("config: base_url inválida rechazada");
      // CORS
      r = await g("/health", { headers: { Origin: "http://evil.example" } }); assert(!r.h.get("access-control-allow-origin")); ok("CORS: origen no listado bloqueado");
      r = await g("/health", { headers: { Origin: "http://localhost:3000" } }); assert(r.h.get("access-control-allow-origin") === "http://localhost:3000"); ok("CORS: localhost permitido en desarrollo");
      r = await g("/server.js"); assert(r.s === 404); ok("estáticos: server.js no se sirve");
      rd.cancel();
    } catch (e) { console.log(results.join("\n")); console.error("FALLO:", e.message); process.exit(1); }
    console.log(results.join("\n")); console.log(results.length + " pruebas OK"); process.exit(0);
  });
});
