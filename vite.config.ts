import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";

const enginePort = process.env.KENGINE_PORT || "5173";
const engineProxy = {
  target: `http://127.0.0.1:${enginePort}`,
  changeOrigin: true,
  timeout: 0,
  proxyTimeout: 0,
};

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    proxy: {
      "/health": engineProxy,
      "/models": engineProxy,
      "/chat": engineProxy,
      "/config": engineProxy,
      "/bridge": engineProxy,
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  worker: { format: "es" },
  plugins: [
    appEnvPlugin(),
    grokPwaPlugin(),
    tailwindcss(),
    viteReact(),
  ],
});
