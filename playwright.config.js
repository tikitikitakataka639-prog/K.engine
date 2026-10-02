import { defineConfig } from "@playwright/test";

// E2E_BASE_URL: URL de una instancia ya levantada (p. ej. http://app:8080 en docker compose).
// Si no se define, Playwright arranca `npm run dev` por su cuenta.
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:8080";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    launchOptions: {
      // WebGPU en Chromium headless: sin GPU real suele no haber adaptador (los tests lo detectan y se adaptan).
      args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan,WebGPU", "--ignore-gpu-blocklist"],
    },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
