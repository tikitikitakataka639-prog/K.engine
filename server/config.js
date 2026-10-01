"use strict";
// Configuración única, leída de variables de entorno. Sin valores secretos por defecto.
const env = process.env;
const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== "" ? Number(v) : d);

const config = {
  version: "1.2.0",
  env: env.KENGINE_ENV === "production" ? "production" : "development",
  host: env.KENGINE_HOST || "127.0.0.1",
  port: num(env.KENGINE_PORT, 5173),
  // Proveedor de inferencia (cualquier endpoint compatible con OpenAI)
  baseUrl: (env.KENGINE_BASE_URL || "").replace(/\/+$/, ""),
  apiKey: env.KENGINE_API_KEY || "",
  model: env.KENGINE_MODEL || "",
  timeoutMs: num(env.KENGINE_TIMEOUT_MS, 120000),
  // Seguridad
  authToken: env.KENGINE_AUTH_TOKEN || "",
  // KENGINE_CORS_ORIGIN (lista separada por comas); KENGINE_CORS_ORIGINS se mantiene como alias.
  corsOrigins: (env.KENGINE_CORS_ORIGIN || env.KENGINE_CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean),
  maxBodyBytes: num(env.KENGINE_MAX_BODY_BYTES, 256 * 1024),
  // Contexto (aprox. 1 token ≈ 4 caracteres; no hay tokenizador real en el servidor)
  contextMaxChars: num(env.KENGINE_CONTEXT_MAX_CHARS, 12000),
  contextMaxMessages: num(env.KENGINE_CONTEXT_MAX_MESSAGES, 24),
  maxMessageChars: num(env.KENGINE_MAX_MESSAGE_CHARS, 8000),
  // "auto" | "openai-compatible" | "webllm"
  defaultBackend: ["openai-compatible", "webllm"].includes(env.KENGINE_BACKEND) ? env.KENGINE_BACKEND : "auto",
  maxTokens: num(env.KENGINE_MAX_TOKENS, 1024),
  serveStatic: env.KENGINE_SERVE_STATIC !== "0"
};

const isLoopback = (h) => ["127.0.0.1", "localhost", "::1"].includes(h);

config.validate = function () {
  if (!isLoopback(config.host) && !config.authToken) {
    throw new Error("KENGINE_HOST=" + config.host + " expone la API fuera de localhost: define KENGINE_AUTH_TOKEN.");
  }
  if (config.env === "production" && config.corsOrigins.includes("*")) {
    throw new Error("KENGINE_CORS_ORIGIN=* no está permitido en producción: indica los orígenes concretos.");
  }
  if (config.env === "production" && !config.authToken) {
    throw new Error("KENGINE_ENV=production exige KENGINE_AUTH_TOKEN.");
  }
};
config.isLoopback = isLoopback;
export default config;
