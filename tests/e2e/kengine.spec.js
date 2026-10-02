// Pruebas E2E REALES de la interfaz en Chromium (Playwright).
// Qué NO prueban salvo que haya GPU real: la inferencia WebLLM/WebGPU. Esos tests (`@gpu`) se saltan con motivo
// explícito si el navegador de pruebas no ofrece un adaptador WebGPU con shader-f16, o si no se define E2E_REAL_MODEL=1
// (descarga ~0,7 GB desde Hugging Face).
import { test, expect } from "@playwright/test";
import { KERNEL_PERSONALITY } from "../../src/engine/personality.js";

const LLAMA = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const card = (page, id = LLAMA) => page.locator(`[data-testid=model-card][data-model-id="${id}"]`);

async function gpuInfo(page) {
  return page.evaluate(async () => {
    if (!navigator.gpu) return { nav: false, adapter: false, f16: false };
    const a = await navigator.gpu.requestAdapter().catch(() => null);
    return { nav: true, adapter: Boolean(a), f16: Boolean(a && a.features.has("shader-f16")) };
  });
}
async function startEngine(page) {
  await page.getByTestId("start-engine-btn").click();
  await expect(page.getByTestId("engine-started")).toBeVisible();
}

test.describe("arranque", () => {
  test("la web abre sin errores y sin dependencias de Grok ni de CDN", async ({ page }) => {
    const errors = [];
    const external = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (/grok\.com|googleapis|gstatic|cdn\.tailwindcss|esm\.sh|jsdelivr|esm\.run/.test(u.host)) external.push(r.url());
    });
    await page.goto("/");
    await expect(page.getByTestId("start-engine-btn")).toBeVisible();
    await expect(page.getByTestId("model-card")).toHaveCount(4);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("el catálogo sale de WebLLM y no contiene LLaVA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("model-card")).toHaveCount(4);
    const ids = await page.locator("[data-testid=model-card]").evaluateAll((els) => els.map((e) => e.dataset.modelId));
    expect(ids).toEqual([LLAMA, "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", "Llama-3.2-3B-Instruct-q4f16_1-MLC"]);
    expect(ids.join()).not.toMatch(/llava/i);
    const all = await page.getByTestId("any-model-select").locator("option").count();
    expect(all).toBeGreaterThan(20); // lista real de prebuiltAppConfig.model_list
  });

  test("las descargas están bloqueadas hasta INICIAR MOTOR", async ({ page }) => {
    await page.goto("/");
    await expect(card(page).getByTestId("model-main-btn")).toBeDisabled();
    await expect(card(page).getByTestId("model-main-btn")).toHaveText("INICIA EL MOTOR");
  });
});

test.describe("inicio del motor y URL de KERNEL", () => {
  test("INICIAR MOTOR → pide la URL de K.E.R.N.E.L sin inventar ninguna", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("kernel-url-panel")).toHaveCount(0);
    await startEngine(page);
    await expect(page.getByTestId("kernel-url-panel")).toContainText("INTRODUCIR URL DE K.E.R.N.E.L");
    await expect(page.getByTestId("kernel-url-input")).toHaveValue("");
    await expect(page.getByTestId("kernel-url-saved")).toHaveCount(0);
  });

  test("valida, guarda y persiste la URL; se puede cambiar", async ({ page }) => {
    await page.goto("/");
    await startEngine(page);
    await page.getByTestId("kernel-url-input").fill("esto no es una url");
    await page.getByTestId("kernel-url-save").click();
    await expect(page.getByTestId("kernel-url-error")).toBeVisible();
    await page.getByTestId("kernel-url-input").fill("javascript:alert(1)");
    await page.getByTestId("kernel-url-save").click();
    await expect(page.getByTestId("kernel-url-error")).toContainText("http");
    await page.getByTestId("kernel-url-input").fill("https://kernel.invalid/app");
    await page.getByTestId("kernel-url-save").click();
    await expect(page.getByTestId("kernel-url-saved")).toHaveText("https://kernel.invalid/app");
    await page.reload();
    await startEngine(page);
    await expect(page.getByTestId("kernel-url-saved")).toHaveText("https://kernel.invalid/app");
    await page.getByRole("button", { name: "Cambiar" }).click();
    await page.getByTestId("kernel-url-input").fill("http://localhost:9999/");
    await page.getByTestId("kernel-url-save").click();
    await expect(page.getByTestId("kernel-url-saved")).toHaveText("http://localhost:9999/");
  });
});

test.describe("WebGPU y compatibilidad", () => {
  test("la detección de la UI coincide con lo que el navegador ofrece de verdad", async ({ page }) => {
    await page.goto("/");
    const gpu = await gpuInfo(page);
    await startEngine(page);
    await expect(page.locator("#hwNavGpu")).toHaveText(gpu.nav ? "SÍ" : "NO");
    await expect(page.locator("#hwAdapter")).toHaveText(gpu.adapter ? "ADAPTADOR OBTENIDO" : "SIN ADAPTADOR");
    if (gpu.adapter) await expect(page.locator("#hwF16")).toHaveText(gpu.f16 ? "SÍ" : "NO");
    test.info().annotations.push({ type: "entorno", description: JSON.stringify(gpu) });
  });

  test("sin WebGPU/shader-f16 NO se fuerza la carga y se explica el requisito", async ({ page }) => {
    await page.goto("/");
    const gpu = await gpuInfo(page);
    test.skip(gpu.adapter && gpu.f16, "Este navegador SÍ tiene WebGPU con shader-f16: no aplica.");
    await startEngine(page);
    await expect(card(page).getByTestId("model-class")).toContainText("NO COMPATIBLE");
    await expect(card(page).getByTestId("model-main-btn")).toBeDisabled();
    await card(page).locator("summary").click();
    await expect(card(page)).toContainText(/WebGPU|shader-f16|adaptador/i);
  });

  test("la VRAM declarada cambia la clasificación (con GPU compatible)", async ({ page }) => {
    await page.goto("/");
    const gpu = await gpuInfo(page);
    test.skip(!(gpu.adapter && gpu.f16), "Necesita adaptador WebGPU con shader-f16.");
    await startEngine(page);
    await page.getByTestId("vram-input").fill("2");
    await expect(card(page, "Llama-3.2-3B-Instruct-q4f16_1-MLC").getByTestId("model-class")).toContainText("NO COMPATIBLE");
    await page.getByTestId("vram-input").fill("16");
    await expect(card(page, "Llama-3.2-3B-Instruct-q4f16_1-MLC").getByTestId("model-class")).toContainText("RECOMENDADO");
  });
});

test.describe("selección de modelo", () => {
  test("se puede elegir manualmente cualquier modelo de WebLLM", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("model-card")).toHaveCount(4);
    const select = page.getByTestId("any-model-select");
    const other = await select.locator("option").evaluateAll((os) => os.map((o) => o.value).find((v) => /^SmolLM2-360M-Instruct/.test(v)) || os[os.length - 1].value);
    await select.selectOption(other);
    await expect(card(page, other)).toBeVisible();
  });
});

test.describe("descarga: errores y estados (con GPU compatible)", () => {
  test("un fallo de red muestra el error, permite reintentar y NUNCA queda READY", async ({ page }) => {
    await page.goto("/");
    const gpu = await gpuInfo(page);
    test.skip(!(gpu.adapter && gpu.f16), "Necesita adaptador WebGPU con shader-f16 para llegar a la descarga.");
    // Fallo de red provocado: se bloquea el origen de los pesos del modelo.
    await page.route(/huggingface\.co|raw\.githubusercontent\.com/, (r) => r.abort("failed"));
    await startEngine(page);
    await card(page).getByTestId("model-main-btn").click();
    await expect(card(page)).toHaveAttribute("data-status", "ERROR", { timeout: 30_000 });
    await expect(card(page).getByTestId("model-error")).toContainText(/CreateMLCEngine|network|fetch/i);
    await expect(card(page).getByTestId("model-main-btn")).toHaveText("REINTENTAR");
    await expect(card(page).getByTestId("model-main-btn")).toBeEnabled();
  });
});

test.describe("formatear modelo (borrado por modelo con WebLLM)", () => {
  // Fixture: se siembra la entrada ndarray-cache.json en la caché `webllm/model`, que es lo que
  // hasModelInCache() consulta (ndarray-cache.json con 0 shards). NO es un modelo real: solo prueba el flujo de detección + borrado.
  const seed = async (page) =>
    page.evaluate(async (id) => {
      const url = `https://huggingface.co/mlc-ai/${id}/resolve/main/ndarray-cache.json`;
      const c = await caches.open("webllm/model");
      await c.put(new Request(url), new Response('{"metadata":{},"records":[]}', { headers: { "content-type": "application/json" } }));
      return url;
    }, LLAMA);

  test("detecta datos locales, pide confirmación y borra solo ese modelo", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))));
    const other = await page.evaluate(async () => {
      const c = await caches.open("webllm/other-test-model");
      await c.put(new Request("https://example.invalid/keep.bin"), new Response("x"));
    });
    await seed(page);
    await page.reload();
    await startEngine(page);
    await expect(card(page)).toHaveAttribute("data-status", "DOWNLOADED");
    await expect(card(page).getByTestId("model-main-btn")).toHaveText(/CARGAR|INICIA/);
    await card(page).getByTestId("model-format-btn").click();
    await expect(card(page).getByTestId("format-confirm")).toBeVisible();
    await card(page).getByRole("button", { name: "NO", exact: true }).click(); // cancelar no borra
    await expect(card(page)).toHaveAttribute("data-status", "DOWNLOADED");
    await card(page).getByTestId("model-format-btn").click();
    await card(page).getByTestId("format-confirm-btn").click();
    await expect(card(page)).toHaveAttribute("data-status", "NOT_DOWNLOADED");
    await expect(card(page).getByTestId("format-result")).toContainText("eliminados");
    const left = await page.evaluate(async () => (await caches.keys()).includes("webllm/other-test-model") && (await (await caches.open("webllm/other-test-model")).keys()).length);
    expect(left).toBe(1); // no se borra la Cache API entera
    void other;
  });
});

test.describe("laboratorio", () => {
  test("sin modelo READY el chat está bloqueado y se indica el modelo", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#labInput")).toBeDisabled();
    await expect(page.getByTestId("lab-model-id")).toHaveText(LLAMA);
    await expect(page.getByTestId("lab-chat")).toContainText("PERSONALITY: KERNEL");
  });

  test("personalidad de KERNEL: voz, rigor y brújula presentes", () => {
    const p = KERNEL_PERSONALITY.systemPrompt;
    for (const s of ["España", "joder", "Estoy jodido, así que no dejaré que el resto se jodan", "HECHOS", "INDICIOS", "HIPÓTESIS", "OPINIÓN", "BOE", "Te equivocas", "Me equivoqué", "Vale, esto ya es serio"]) {
      expect(p).toContain(s);
    }
    expect(p).toMatch(/Nunca empieces con "¡Hola!/);
  });

  test("@gpu flujo completo con modelo real: descargar → READY → chat → liberar → formatear", async ({ page }) => {
    test.setTimeout(30 * 60_000);
    await page.goto("/");
    const gpu = await gpuInfo(page);
    test.skip(!(gpu.adapter && gpu.f16), "Necesita adaptador WebGPU con shader-f16 (el Chromium headless de CI normalmente no lo tiene).");
    test.skip(process.env.E2E_REAL_MODEL !== "1", "Descarga ~0,7 GB desde Hugging Face: ejecútalo con E2E_REAL_MODEL=1.");
    await startEngine(page);
    const main = card(page).getByTestId("model-main-btn");
    await main.click();
    const seen = new Set();
    await expect
      .poll(
        async () => {
          seen.add(await main.innerText());
          return card(page).getAttribute("data-status");
        },
        { timeout: 25 * 60_000, intervals: [500] },
      )
      .toBe("READY");
    expect([...seen].some((t) => /^\d+%$/.test(t))).toBe(true); // se vio un porcentaje real
    await page.locator("#labInput").fill("Dime en una frase qué eres.");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByTestId("msg-kernel").last()).not.toHaveText("", { timeout: 120_000 });
    await expect(page.locator("#labInput")).toBeEnabled({ timeout: 120_000 });
    await card(page).getByTestId("model-unload-btn").click();
    await expect(card(page)).toHaveAttribute("data-status", "DOWNLOADED");
    await card(page).getByTestId("model-format-btn").click();
    await card(page).getByTestId("format-confirm-btn").click();
    await expect(card(page)).toHaveAttribute("data-status", "NOT_DOWNLOADED", { timeout: 60_000 });
  });
});
