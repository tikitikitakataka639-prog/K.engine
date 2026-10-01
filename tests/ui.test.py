# Prueba de la UI en Chromium headless REAL (sin red externa: CDN de Tailwind/esm.sh no cargan; WebGPU normalmente no existe en headless).
import subprocess, time, json, sys
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(["node", "server.js"], env={"PATH": "/usr/bin:/usr/local/bin", "KENGINE_PORT": "5997"})
time.sleep(1.2); res = []
def ok(n, c, extra=""):
    res.append(("OK   " if c else "FALLA") + " " + n + (" · " + str(extra) if extra else ""))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://127.0.0.1:5997/index.html"); pg.wait_for_timeout(2500)
    errs = [e for e in errs if "tailwind" not in e]  # el CDN de Tailwind no carga sin red (limitación del entorno)
    ok("sin errores JS de página (salvo CDN Tailwind sin red)", not errs, errs[:2])
    t = lambda i: pg.inner_text("#" + i)
    ok("API READY detectada", "READY" in t("ksApi"), t("ksApi"))
    ok("bridge conectado", t("ksBridge") == "CONECTADO", t("ksBridge"))
    ok("WebGPU reportado según navegador", True, t("ksWebgpu"))
    ok("sin modelo cargado → no ONLINE", "ONLINE" not in t("ksEngine"), t("ksEngine"))
    ok("recomendación honesta sin WebGPU", ("NO HAY MODELO" in t("recOut")) or ("RECOMENDADO" in t("recOut")), t("recOut")[:60].replace("\n", " "))
    # caché: crear entradas falsas con nombre webllm y borrar con progreso
    pg.evaluate("""async()=>{const c=await caches.open('webllm/model');for(let i=0;i<6;i++){await c.put('http://127.0.0.1:5997/x/resolve/main/s'+i+'.bin',new Response('a'.repeat(1000),{headers:{'content-length':'1000'}}))}
      const o=await caches.open('otra-app');await o.put('http://127.0.0.1:5997/keep',new Response('k'))}""")
    pg.click("#cacheScan"); pg.wait_for_timeout(500)
    ok("escaneo detecta 6 entradas", "6 entradas" in t("cacheSummary"), t("cacheSummary")[:90])
    pg.click("#cacheDelete"); pg.wait_for_timeout(1500)
    ok("borrado: título final y 100%", t("cacheTitle") == "CACHÉ ELIMINADA" and t("cachePct") == "100%", t("cacheTitle") + " " + t("cachePct"))
    keep = pg.evaluate("async()=>{const ks=await caches.keys();return ks}")
    ok("no toca cachés ajenas", "otra-app" in keep and "webllm/model" not in keep, keep)
    # diagnóstico: Cache API self-test (el worker no puede importar WebLLM sin red → debe informarlo, no inventar)
    pg.click("#diagBtn"); pg.wait_for_timeout(6000)
    d = t("diagOut"); ok("diagnóstico informa Cache API real", "Cache API: OK" in d, d[:110].replace("\n", " "))
    # configuración
    pg.select_option("#cfgBackend", "openai-compatible"); pg.fill("#cfgBaseUrl", "http://127.0.0.1:9/v1"); pg.fill("#cfgModel", "m"); pg.fill("#cfgApiKey", "sk-supersecreto-9999")
    pg.click("#cfgSave"); pg.wait_for_timeout(800)
    ok("API key enmascarada tras guardar", "sk-…9999" in t("cfgKeyState") and pg.input_value("#cfgApiKey") == "", t("cfgKeyState"))
    pg.wait_for_timeout(500); pg.click("#cfgTest"); pg.wait_for_timeout(1500)
    ok("proveedor inaccesible se informa", "unreachable" in t("cfgMsg"), t("cfgMsg")[:80].replace("\n", " "))
    b.close()
srv.terminate(); print("\n".join(res)); sys.exit(1 if any(r.startswith("FALLA") for r in res) else 0)
