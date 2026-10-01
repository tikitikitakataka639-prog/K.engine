#!/usr/bin/env node
/**
 * Arranca K.ENGINE (server.js) y Vite en el mismo comando.
 * Vite sirve la UI React en 0.0.0.0:8080 y proxifica /health /models /chat /config /bridge al motor.
 */
import { spawn } from "node:child_process";
import http from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const enginePort = process.env.KENGINE_PORT || "5173";
const engineHost = process.env.KENGINE_HOST || "127.0.0.1";

const children = [];

function spawnChild(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    try { child.kill("SIGTERM"); } catch {}
  }
  setTimeout(() => process.exit(code), 200);
}

function waitForHealth(timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${enginePort}/health`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else retry();
      });
      req.on("error", retry);
      req.setTimeout(1500, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error("K.ENGINE no respondió en /health"));
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  });
}

const engine = spawnChild(process.execPath, ["server.js"], {
  KENGINE_HOST: engineHost,
  KENGINE_PORT: enginePort,
});
engine.on("exit", (code, signal) => {
  if (signal) return;
  if (code && code !== 0) {
    console.error("[dev] server.js salió con código", code);
    shutdown(code);
  }
});

try {
  await waitForHealth();
} catch (err) {
  console.error("[dev]", err instanceof Error ? err.message : err);
  shutdown(1);
}

const vite = spawnChild(process.execPath, [
  path.join(root, "scripts/with-app-env.mjs"),
  "vite",
  "dev",
  "--host",
  "0.0.0.0",
  "--port",
  "8080",
]);
vite.on("exit", (code) => shutdown(code ?? 0));

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
