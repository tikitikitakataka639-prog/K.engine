import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// La API de K.ENGINE (server.js) corre aparte; Vite la proxifica en dev y en preview.
const enginePort = process.env.KENGINE_PORT || "5173";
const engineProxy = {
  target: `http://127.0.0.1:${enginePort}`,
  changeOrigin: true,
  timeout: 0,
  proxyTimeout: 0,
};
const proxy = Object.fromEntries(["/health", "/models", "/chat", "/config", "/bridge"].map((p) => [p, engineProxy]));

export default defineConfig({
  server: { host: "0.0.0.0", port: 8080, strictPort: true, allowedHosts: true, proxy },
  preview: { host: "0.0.0.0", port: 4173, strictPort: true, allowedHosts: true, proxy },
  worker: { format: "es" },
  build: { target: "esnext" },
  plugins: [tailwindcss(), react()],
});
