"use strict";
// Gestor de contexto: límite por mensajes y caracteres, poda de los más antiguos.
// No resume ni reescribe: lo que se conserva es literal, lo que se descarta se cuenta.
import cfg from "./config.js";

const ROLES = new Set(["user", "assistant"]);

function sanitize(list) {
  const out = [];
  for (const m of Array.isArray(list) ? list : []) {
    if (!m || typeof m.content !== "string" || !ROLES.has(m.role)) continue; // sin system/tool desde el cliente
    const content = m.content.trim().slice(0, cfg.maxMessageChars);
    if (content) out.push({ role: m.role, content });
  }
  return out;
}

// systemChars: tamaño de las instrucciones del sistema, que SIEMPRE se conservan y cuentan en el presupuesto.
function build(history, message, systemChars = 0) {
  const all = sanitize(history);
  const budget = Math.max(cfg.contextMaxChars - systemChars, message.length);
  all.push({ role: "user", content: message });
  let dropped = 0;
  while (all.length > 1 && (all.length > cfg.contextMaxMessages ||
         all.reduce((n, m) => n + m.content.length, 0) > budget)) {
    all.shift(); dropped++;
  }
  while (all.length > 1 && all[0].role !== "user") { all.shift(); dropped++; } // empezar en turno de usuario
  return { messages: all, dropped, chars: all.reduce((n, m) => n + m.content.length, 0) + systemChars };
}
export { build, sanitize };
export default { build, sanitize };
