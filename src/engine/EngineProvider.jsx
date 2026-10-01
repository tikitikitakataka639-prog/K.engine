import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MODEL_CATALOG, DEFAULT_MODEL_ID } from "../webllm/catalog";
import { KERNEL_PERSONALITY } from "./personality";
import { api, probeApi, tokenGet, tokenSet } from "../api/client";
import { scanCaches, cacheApiSelfTest, classify, formatCacheSummary, storageEstimateLine, fmtBytes } from "../api/cache";

const EngineContext = createContext(null);
export function useEngine() {
  const v = useContext(EngineContext);
  if (!v) throw new Error("useEngine debe usarse dentro de EngineProvider");
  return v;
}

const BUSY = ["DOWNLOADING", "LOADING", "READY", "GENERATING", "UNLOADING", "DOWNLOADED"];
const GOOD = "text-volt";
const BAD = "text-red2";
const WARN = "text-amber2";
const NEUTRAL = "text-slate-200";

function emptyHardware() {
  return {
    webgpu: false,
    webgpuLabel: "COMPROBANDO…",
    webgpuClass: "text-slate-300",
    gpu: "—",
    buf: "—",
    cores: "—",
    hwClass: "—",
    hwClassStatus: "—",
    hwClassStatusClass: "text-slate-300",
    rec: "—",
    adapterHasF16: false,
  };
}

function emptyMetrics() {
  return { tokens: "N/A", tps: "N/A", genTime: "N/A", firstTok: "N/A", ctx: "4096 (según MLC config)" };
}

function emptyControl() {
  return {
    ksEngine: "—",
    ksEngineClass: "text-slate-200",
    ksBackend: "—",
    ksModel: "—",
    ksWebgpu: "—",
    ksWebgpuClass: "text-slate-200",
    ksCache: "—",
    ksCacheClass: "text-slate-400",
    ksApi: "—",
    ksApiClass: "text-slate-200",
    ksBridge: "—",
    ksBridgeClass: "text-slate-200",
    recOut: "",
    recApplyHidden: true,
    cacheSummary: "Sin escanear.",
    cacheBarWrap: false,
    cacheTitle: "ELIMINANDO CACHÉ",
    cachePct: "0%",
    cacheBar: 0,
    cacheDetail: "",
    cacheDeleteDisabled: true,
    diagOut: "",
    diagFixHidden: true,
    cfgBackend: "auto",
    cfgBaseUrl: "",
    cfgApiKey: "",
    cfgModel: "",
    cfgToken: "",
    cfgKeyState: "",
    cfgMsg: "",
    cfgDisabled: false,
  };
}

export function EngineProvider({ children }) {
  const [status, setStatus] = useState("NOT_INSTALLED");
  const [generating, setGenerating] = useState(false);
  const [defaultModel, setDefaultModel] = useState(DEFAULT_MODEL_ID);
  const [progress, setProgress] = useState({ phase: null, value: 0, text: "" });
  const [engineError, setEngineError] = useState(null);
  const [labError, setLabError] = useState(null);
  const [labStatus, setLabStatus] = useState("OFFLINE");
  const [cacheStatus, setCacheStatus] = useState("COMPROBANDO…");
  const [hardware, setHardware] = useState(emptyHardware);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [messages, setMessages] = useState([]);
  const [control, setControl] = useState(emptyControl);
  const [sendEnabled, setSendEnabled] = useState(false);

  const workerRef = useRef(null);
  const adapterRef = useRef(null);
  const webgpuRef = useRef(false);
  const statusRef = useRef(status);
  const generatingRef = useRef(generating);
  const defaultModelRef = useRef(defaultModel);
  const sessionsRef = useRef({});
  const streamingRef = useRef(false);
  const keRef = useRef({
    apiOk: false,
    version: null,
    cid: null,
    lastReported: "",
    job: null,
    scan: null,
    rec: null,
    recs: null,
    diag: [],
    lastLoadError: null,
    hooked: null,
    recsResolve: null,
  });
  const diagResolveRef = useRef(null);
  const listenersRef = useRef(new Set());

  statusRef.current = status;
  generatingRef.current = generating;
  defaultModelRef.current = defaultModel;

  const patchControl = useCallback((partial) => {
    setControl((prev) => ({ ...prev, ...partial }));
  }, []);

  const modelBusy = useCallback(() => BUSY.includes(statusRef.current), []);

  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(new URL("../webllm/kengine-worker.js", import.meta.url), { type: "module" });
    w.addEventListener("message", (msg) => {
      listenersRef.current.forEach((fn) => fn(msg.data));
    });
    w.addEventListener("error", (e) => {
      setEngineError("Error del worker: " + (e.message || "desconocido"));
      if (diagResolveRef.current) diagResolveRef.current({ workerFailed: true, message: e.message || "error del worker" });
    });
    workerRef.current = w;
    return w;
  }, []);

  const handleWorker = useCallback(
    (d) => {
      switch (d.type) {
        case "status":
          setStatus(d.value);
          setLabStatus(d.value);
          if (["DOWNLOADING", "LOADING", "UNLOADING", "DOWNLOADED"].includes(d.value)) {
            setProgress({ phase: d.value, value: d.value === "DOWNLOADED" ? 1 : 0, text: "" });
          }
          break;
        case "log":
          console.info(d.message);
          break;
        case "progress":
          setProgress({ phase: d.phase, value: d.progress || 0, text: d.text || "" });
          setStatus(d.phase);
          setLabStatus(d.phase);
          break;
        case "verified":
        case "ready":
          setStatus("READY");
          setLabStatus("READY");
          setProgress({ phase: "READY", value: 1, text: "" });
          setCacheStatus("CACHE SAVED");
          setSendEnabled(true);
          setEngineError(null);
          break;
        case "genstart":
          setGenerating(true);
          setLabStatus("GENERATING");
          setStatus("GENERATING");
          break;
        case "token":
          if (!streamingRef.current) {
            streamingRef.current = true;
            setMessages((prev) => [...prev, { role: "assistant", content: d.delta }]);
          } else {
            setMessages((prev) => {
              const next = prev.slice();
              const last = next[next.length - 1];
              if (last && last.role === "assistant") next[next.length - 1] = { ...last, content: last.content + d.delta };
              else next.push({ role: "assistant", content: d.delta });
              return next;
            });
          }
          break;
        case "usage":
          setMetrics((m) => ({
            ...m,
            tokens: d.completionTokens != null ? String(d.completionTokens) : m.tokens,
            genTime: d.genMs != null ? (d.genMs / 1000).toFixed(1) + " s" : m.genTime,
            firstTok: d.firstTokenMs != null ? d.firstTokenMs + " ms" : m.firstTok,
            tps: d.tps != null ? String(d.tps) : m.tps,
          }));
          break;
        case "gendone": {
          setGenerating(false);
          setLabStatus("READY");
          setStatus("READY");
          setSendEnabled(true);
          const session = (sessionsRef.current[defaultModelRef.current] ||= []);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant") session.push({ role: "assistant", content: last.content });
            return prev;
          });
          streamingRef.current = false;
          break;
        }
        case "unloaded":
          setStatus("NOT_INSTALLED");
          setLabStatus("OFFLINE");
          setProgress({ phase: null, value: 0, text: "" });
          setCacheStatus("CACHE FOUND · modelo no cargado");
          setSendEnabled(false);
          break;
        case "error":
          setStatus("ERROR");
          setLabStatus("ERROR");
          setGenerating(false);
          setSendEnabled(true);
          setEngineError("ERROR [" + d.scope + "]: " + d.message);
          setLabError(d.scope === "generate" ? "Fallo en la generación: " + d.message : null);
          keRef.current.lastLoadError = d.message;
          if (/Cache|network|fetch/i.test(d.message)) {
            patchControl({ diagOut: "Error de carga detectado. Pulsa DIAGNOSTICAR RECURSOS para identificar el recurso exacto." });
          }
          break;
        default:
          break;
      }
    },
    [patchControl],
  );

  useEffect(() => {
    listenersRef.current.add(handleWorker);
    return () => listenersRef.current.delete(handleWorker);
  }, [handleWorker]);

  const reportState = useCallback(async () => {
    const KE = keRef.current;
    if (!KE.apiOk || !KE.cid) return;
    const key = statusRef.current + "|" + defaultModelRef.current;
    if (key === KE.lastReported) return;
    KE.lastReported = key;
    const loaded = statusRef.current === "READY" || statusRef.current === "GENERATING" ? defaultModelRef.current : null;
    try {
      await api("/bridge/state", {
        method: "POST",
        body: JSON.stringify({
          client_id: KE.cid,
          loaded_model: loaded,
          state: statusRef.current === "GENERATING" ? "READY" : statusRef.current,
        }),
      });
    } catch {
      KE.lastReported = "";
    }
  }, []);

  const flushJob = useCallback(async (final) => {
    const KE = keRef.current;
    const j = KE.job;
    if (!j) return;
    clearTimeout(j.timer);
    j.timer = null;
    const body = { client_id: KE.cid, job_id: j.jobId };
    if (j.buf) {
      body.delta = j.buf;
      j.buf = "";
    }
    if (final) {
      if (j.err) body.error = j.err;
      else body.done = true;
      KE.job = null;
    }
    if (!body.delta && !final) return;
    try {
      await api("/bridge/chunk", { method: "POST", body: JSON.stringify(body) });
    } catch {
      /* reintento del loop */
    }
  }, []);

  const jobFromWorker = useCallback(
    (d) => {
      const j = keRef.current.job;
      if (!j) return;
      if (d.type === "token" && d.id === j.id) {
        j.buf += d.delta;
        if (!j.timer) j.timer = setTimeout(() => flushJob(false), 80);
      } else if (d.type === "gendone" && d.id === j.id) {
        flushJob(true);
      } else if (d.type === "error" && d.scope === "generate") {
        j.err = d.message;
        flushJob(true);
      }
    },
    [flushJob],
  );

  const hookWorker = useCallback(() => {
    const w = workerRef.current;
    const KE = keRef.current;
    if (!w || KE.hooked === w) return;
    KE.hooked = w;
    const onMsg = (d) => {
      if (d.type === "models" && d.records) {
        KE.recs = d.records;
        if (KE.recsResolve) KE.recsResolve();
      } else if (d.type === "diag") {
        KE.diag.push(d.item);
        patchControl({
          diagOut: KE.diag
            .map(
              (i) =>
                (i.ok ? "OK   " : "FALLA") +
                " " +
                (i.status || "") +
                " " +
                i.url +
                (i.error ? "\n       " + i.error : "") +
                (i.redirected ? "\n       → redirigido a " + i.finalUrl : ""),
            )
            .join("\n"),
        });
      } else if (d.type === "diag_done" && diagResolveRef.current) {
        diagResolveRef.current(d);
      } else if (d.type === "error" && diagResolveRef.current && /importar/.test(d.message)) {
        diagResolveRef.current({ workerFailed: true, message: d.message });
      }
      if (KE.job) jobFromWorker(d);
      if (d.type === "status" || d.type === "verified" || d.type === "unloaded" || d.type === "ready") {
        reportState();
      }
    };
    listenersRef.current.add(onMsg);
  }, [jobFromWorker, patchControl, reportState]);

  const startJob = useCallback(
    (job) => {
      const KE = keRef.current;
      const refuse = (m) =>
        api("/bridge/chunk", { method: "POST", body: JSON.stringify({ client_id: KE.cid, job_id: job.job_id, error: m }) }).catch(() => {});
      if (statusRef.current !== "READY" || generatingRef.current || KE.job) {
        return refuse(
          "La pestaña K.ENGINE no está lista (estado: " + statusRef.current + (generatingRef.current ? ", generando" : "") + ")",
        );
      }
      KE.job = { jobId: job.job_id, id: 1e9 + Math.floor(Math.random() * 1e9), buf: "", timer: null, err: null };
      hookWorker();
      streamingRef.current = false;
      getWorker().postMessage({ type: "generate", id: KE.job.id, model: defaultModelRef.current, messages: job.messages, max_tokens: job.max_tokens });
    },
    [getWorker, hookWorker],
  );

  const refreshCache = useCallback(async () => {
    try {
      const s = (keRef.current.scan = await scanCaches());
      const est = await storageEstimateLine();
      const txt = formatCacheSummary(s, est);
      const ksCache = !s.supported ? "NO DISPONIBLE" : s.total === 0 ? "SIN ENTRADAS" : fmtBytes(s.knownBytes) + (s.unknown ? "+" : "");
      patchControl({
        cacheSummary: txt,
        ksCache,
        ksCacheClass: s.total ? NEUTRAL : "text-slate-400",
        cacheDeleteDisabled: !s.supported || s.total === 0,
      });
      if (statusRef.current === "NOT_INSTALLED") {
        setCacheStatus(s.total ? "CACHE FOUND · " + s.total + " entradas" : "SIN ENTRADAS");
      }
    } catch (e) {
      patchControl({ cacheSummary: "Error al escanear la caché: " + ((e && e.message) || e) });
    }
  }, [patchControl]);

  const refreshStatus = useCallback(async () => {
    const KE = keRef.current;
    const s = statusRef.current;
    const w = webgpuRef.current;
    let cfgv = null;
    if (KE.apiOk) {
      try {
        cfgv = await api("/config");
      } catch {
        /* sin config */
      }
    }
    let lastModels = null;
    try {
      lastModels = KE.apiOk ? await api("/models") : null;
    } catch {
      lastModels = null;
    }
    const openaiCfg = lastModels && lastModels.backends["openai-compatible"].configured;
    const chk = lastModels && lastModels.models.find((m) => m.backend === "openai-compatible");
    const pref = cfgv ? cfgv.backend : null;
    const active = !KE.apiOk
      ? "webllm"
      : pref === "webllm"
        ? "webllm"
        : pref === "openai-compatible"
          ? "openai-compatible"
          : openaiCfg
            ? "openai-compatible"
            : "webllm";
    const patch = {};
    if (active === "openai-compatible") {
      const up = chk && chk.provider_check !== "unreachable";
      patch.ksEngine = up ? "● ONLINE" : "● OFFLINE (proveedor inaccesible)";
      patch.ksEngineClass = up ? GOOD : BAD;
      patch.ksBackend = "OPENAI-COMPATIBLE";
      patch.ksModel = chk ? chk.id + (chk.provider_check === "not_listed" ? " (no listado por el proveedor)" : "") : "—";
    } else {
      const ready = s === "READY" || s === "GENERATING";
      patch.ksEngine = ready ? "● ONLINE" : s === "ERROR" ? "● ERROR" : "○ " + s;
      patch.ksEngineClass = ready ? GOOD : s === "ERROR" ? BAD : WARN;
      patch.ksBackend = "WEBLLM";
      patch.ksModel = ready ? defaultModelRef.current : "— (ninguno cargado)";
    }
    patch.ksWebgpu = w
      ? "READY" + (adapterRef.current && adapterRef.current.features && adapterRef.current.features.has("shader-f16") ? " · shader-f16" : " · sin shader-f16")
      : "NO DISPONIBLE";
    patch.ksWebgpuClass = w ? GOOD : BAD;
    patch.ksApi = KE.apiOk ? "READY (v" + KE.version + ")" : "NO DISPONIBLE (UI servida sin server.js)";
    patch.ksApiClass = KE.apiOk ? GOOD : WARN;
    if (!KE.apiOk) {
      patch.ksBridge = "N/A (sin API)";
      patch.ksBridgeClass = "text-slate-400";
    }
    patchControl(patch);
  }, [patchControl]);

  const evaluate = useCallback((recs) => {
    const ad = adapterRef.current;
    const res = [];
    const mem = navigator.deviceMemory;
    for (const m of MODEL_CATALOG) {
      if (m.tier === "VISION") continue;
      const r = recs && recs.find((x) => x.id === m.id);
      const why = [],
        warn = [];
      if (!webgpuRef.current) why.push("WebGPU no disponible");
      else if (/q4f16/.test(m.id) && !(ad && ad.features && ad.features.has("shader-f16")))
        why.push("el adaptador no expone shader-f16, requerido por la cuantización q4f16");
      if (r && r.vram_required_MB) {
        if (mem && mem * 1024 < r.vram_required_MB) warn.push("RAM reportada (" + mem + " GB, tope del navegador) < " + r.vram_required_MB + " MB requeridos");
      } else warn.push("requisito de memoria no disponible (lista del worker no cargada)");
      res.push({ m, why, warn, vram: r && r.vram_required_MB });
    }
    return res;
  }, []);

  const showRecommendation = useCallback(
    (recs) => {
      const ev = evaluate(recs);
      const ok = ev.filter((e) => !e.why.length);
      const notes =
        "\n\nNO EXPUESTO POR EL NAVEGADOR: VRAM" +
        (navigator.deviceMemory ? "" : ", RAM") +
        ". WebLLM valida los límites reales del adaptador al cargar.\n\nEVALUACIÓN\n" +
        ev
          .map(
            (e) =>
              (e.why.length ? "✗ " : "✓ ") +
              e.m.short +
              (e.vram ? " (" + e.vram + " MB)" : "") +
              (e.why.length ? " — " + e.why.join("; ") : e.warn.length ? " — aviso: " + e.warn.join("; ") : ""),
          )
          .join("\n");
      if (!ok.length) {
        patchControl({
          recOut: "NO HAY MODELO COMPATIBLE\n\nMotivo:\n" + ev.map((e) => "- " + e.m.short + ": " + e.why.join("; ")).join("\n") + notes,
          recApplyHidden: true,
        });
        keRef.current.rec = null;
        return;
      }
      const pick = ok.find((e) => !e.warn.some((w) => /^RAM/.test(w))) || ok[0];
      keRef.current.rec = pick.m;
      patchControl({
        recOut:
          "MODELO RECOMENDADO\n" +
          pick.m.id.replace(/-Instruct.*$/, "").toLowerCase() +
          "  (" +
          pick.m.short +
          ")\n\nMOTIVO\nCumple los requisitos comprobables (WebGPU" +
          (/q4f16/.test(pick.m.id) ? ", shader-f16" : "") +
          ") y es el de mayor prioridad del catálogo que los cumple." +
          notes,
        recApplyHidden: pick.m.id === defaultModelRef.current,
      });
    },
    [evaluate, patchControl],
  );

  const loadConfig = useCallback(async () => {
    if (!keRef.current.apiOk) {
      patchControl({
        cfgMsg: "Sin API: abre la UI desde `node server.js` para configurar el backend.",
        cfgDisabled: true,
      });
      return;
    }
    patchControl({ cfgToken: tokenGet(), cfgDisabled: false });
    try {
      const c = await api("/config");
      patchControl({
        cfgBackend: c.backend,
        cfgBaseUrl: c.base_url,
        cfgModel: c.model,
        cfgKeyState: c.api_key_set ? "(guardada: " + c.api_key + ")" : "(sin definir)",
        cfgMsg: "Entorno: " + c.env + " · token " + (c.auth_required ? "exigido" : "no exigido"),
      });
    } catch (e) {
      patchControl({
        cfgMsg:
          e.status === 401
            ? "El servidor exige token: escríbelo y pulsa GUARDAR."
            : e.status === 403
              ? "Configuración remota no permitida sin KENGINE_AUTH_TOKEN."
              : "Error: " + e.message,
      });
    }
  }, [patchControl]);

  const detectHardware = useCallback(async () => {
    let webgpu = false,
      adapter = null;
    if (navigator.gpu) {
      try {
        adapter = await navigator.gpu.requestAdapter();
        if (adapter) webgpu = true;
      } catch {
        /* sin WebGPU usable */
      }
    }
    webgpuRef.current = webgpu;
    adapterRef.current = adapter;
    const hw = emptyHardware();
    hw.webgpu = webgpu;
    hw.webgpuLabel = webgpu ? "DISPONIBLE" : "NO DISPONIBLE";
    hw.webgpuClass = webgpu ? "text-volt" : "text-red2";
    hw.adapterHasF16 = Boolean(adapter && adapter.features && adapter.features.has("shader-f16"));
    hw.cores = navigator.hardwareConcurrency ? navigator.hardwareConcurrency + " hilos" : "N/A";
    if (adapter) {
      let info = {};
      try {
        info = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : {});
      } catch {
        /* sin info */
      }
      const desc = info.description || info.vendor || info.architecture || "";
      hw.gpu = desc || "Adaptador detectado (detalles no expuestos)";
      hw.buf = adapter.limits && adapter.limits.maxBufferSize ? Math.round(adapter.limits.maxBufferSize / (1024 * 1024)) + " MB" : "N/A";
    } else {
      hw.gpu = "N/A";
      hw.buf = "N/A";
    }
    let cls = null;
    if (webgpu) {
      const buf = adapter.limits ? adapter.limits.maxBufferSize : 0;
      cls = buf >= 3.5 * 1024 ** 3 ? "ADVANCED" : buf >= 1.5 * 1024 ** 3 ? "MEDIUM" : "LIGHT";
    }
    hw.hwClass = cls || "REQUIERE WEBGPU";
    hw.hwClassStatus = cls || "REQUIERE WEBGPU";
    hw.hwClassStatusClass = cls ? "text-volt" : "text-red2";
    if (cls) {
      const rec = cls === "LIGHT" ? MODEL_CATALOG[0] : cls === "MEDIUM" ? MODEL_CATALOG[3] : MODEL_CATALOG[0];
      hw.rec = rec.short + " (" + rec.tier + ")";
    } else {
      hw.rec = "N/A";
      setEngineError(
        "WebGPU no está disponible en este navegador. K.ENGINE requiere Chrome/Edge 113+ (o equivalente) para inferencia local real. No se simulará la inferencia.",
      );
    }
    setHardware(hw);
    return { webgpu, adapter, cls };
  }, []);

  const downloadModel = useCallback(() => {
    setEngineError(null);
    setCacheStatus("CACHE FOUND · comprobando…");
    setStatus("DOWNLOADING");
    setLabStatus("DOWNLOADING");
    getWorker().postMessage({ type: "load", model: defaultModelRef.current });
  }, [getWorker]);

  const unloadModel = useCallback(() => {
    getWorker().postMessage({ type: "unload" });
  }, [getWorker]);

  const cancelGenerate = useCallback(() => {
    getWorker().postMessage({ type: "cancel" });
  }, [getWorker]);

  const sendChat = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      if (statusRef.current !== "READY" || generatingRef.current) return false;
      const session = (sessionsRef.current[defaultModelRef.current] ||= []);
      session.push({ role: "user", content: trimmed });
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      streamingRef.current = false;
      const payload = [{ role: "system", content: KERNEL_PERSONALITY.systemPrompt }, ...session.slice(-12)];
      setSendEnabled(false);
      setLabError(null);
      getWorker().postMessage({ type: "generate", id: Date.now(), model: defaultModelRef.current, messages: payload });
      return true;
    },
    [getWorker],
  );

  const deleteCaches = useCallback(async () => {
    if (modelBusy()) {
      patchControl({ cacheSummary: "Hay un modelo cargado o en proceso (" + statusRef.current + "). Descárgalo de memoria antes de eliminar la caché." });
      return;
    }
    const s = await scanCaches();
    keRef.current.scan = s;
    if (!s.total) {
      await refreshCache();
      return;
    }
    patchControl({ cacheDeleteDisabled: true, cacheBarWrap: true, cacheTitle: "ELIMINANDO CACHÉ", cacheBar: 0, cachePct: "0%" });
    const useBytes = s.unknown === 0 && s.knownBytes > 0;
    let done = 0,
      freed = 0,
      groupsDone = 0,
      failed = [];
    const before = navigator.storage && navigator.storage.estimate ? (await navigator.storage.estimate()).usage : null;
    for (const [, entries] of s.groups) {
      for (const e of entries) {
        patchControl({
          cacheDetail:
            "Eliminando: " +
            e.req.url.split("/").slice(-2).join("/") +
            "\nModelos eliminados: " +
            groupsDone +
            "/" +
            s.groups.size +
            " · Datos liberados (conocidos): " +
            fmtBytes(freed),
        });
        try {
          const c = await caches.open(e.cache);
          const okDel = await c.delete(e.req);
          if (!okDel) failed.push(e.req.url);
        } catch (err) {
          failed.push(e.req.url + " → " + ((err && err.message) || err));
        }
        done++;
        if (e.size) freed += e.size;
        const pct = useBytes ? Math.floor((freed / s.knownBytes) * 100) : Math.floor((done / s.total) * 100);
        patchControl({
          cacheBar: Math.min(pct, 99),
          cachePct:
            Math.min(pct, 99) +
            "%  (" +
            done +
            "/" +
            s.total +
            " entradas" +
            (useBytes ? ", por bytes" : ", por nº de entradas: el navegador no expone todos los tamaños") +
            ")",
        });
        if (done % 5 === 0) await new Promise((r) => setTimeout(r));
      }
      groupsDone++;
    }
    for (const n of s.caches) {
      try {
        if ((await (await caches.open(n)).keys()).length === 0) await caches.delete(n);
      } catch {
        /* ignore */
      }
    }
    const after = await scanCaches();
    const left = after.total;
    if (left === 0 && failed.length === 0) {
      patchControl({ cacheBar: 100, cachePct: "100%", cacheTitle: "CACHÉ ELIMINADA" });
    } else {
      patchControl({ cacheTitle: "ELIMINACIÓN INCOMPLETA: quedan " + left + " entradas" });
    }
    let delta = "";
    try {
      if (before != null) {
        const a = (await navigator.storage.estimate()).usage;
        delta = " · uso del origen: " + fmtBytes(before) + " → " + fmtBytes(a) + " (estimación del navegador)";
      }
    } catch {
      /* ignore */
    }
    patchControl({
      cacheDetail:
        "Entradas eliminadas: " +
        (s.total - left) +
        "/" +
        s.total +
        " · Modelos/grupos: " +
        groupsDone +
        "/" +
        s.groups.size +
        " · Liberado (tamaños conocidos): " +
        fmtBytes(freed) +
        delta +
        (failed.length ? "\nFallos (" + failed.length + "):\n" + failed.slice(0, 5).join("\n") : ""),
    });
    await refreshCache();
  }, [modelBusy, patchControl, refreshCache]);

  const runDiagnosis = useCallback(async () => {
    keRef.current.diag = [];
    patchControl({ diagOut: "Comprobando Cache API y recursos…", diagFixHidden: false });
    const st = await cacheApiSelfTest();
    let est = "";
    try {
      const e = await navigator.storage.estimate();
      est = "\nAlmacenamiento: usado " + fmtBytes(e.usage || 0) + " / cuota " + fmtBytes(e.quota || 0);
    } catch {
      /* ignore */
    }
    const w = getWorker();
    hookWorker();
    const done = new Promise((res) => {
      diagResolveRef.current = res;
      setTimeout(() => res({ timeout: true }), 120000);
    });
    w.postMessage({ type: "diagnose", model: defaultModelRef.current });
    const r = await done;
    diagResolveRef.current = null;
    const head = "Origen: " + location.origin + " · Cache API: " + (st.ok ? "OK" : "FALLA") + " (" + st.detail + ")" + est + "\n";
    const last =
      r.lastResources && r.lastResources.length
        ? "\n\nÚltimas peticiones vistas por el worker (Resource Timing):\n" + r.lastResources.map((e) => (e.status ?? "?") + " " + e.name).join("\n")
        : "";
    const verdict = r.workerFailed
      ? "El worker no pudo iniciar WebLLM, así que no hay sondeo de recursos: " + r.message
      : r.timeout
        ? "El worker no respondió al diagnóstico (¿falló al importar WebLLM? mira la consola)."
        : classify(keRef.current.diag, st);
    patchControl({
      diagOut:
        head +
        "\n" +
        keRef.current.diag
          .map((i) => (i.ok ? "OK   " : "FALLA") + " " + (i.status || "") + " " + i.url + (i.error ? "\n       " + i.error : ""))
          .join("\n") +
        last +
        "\n\n" +
        verdict,
      diagFixHidden: false,
    });
  }, [getWorker, hookWorker, patchControl]);

  const fixAndRetry = useCallback(async () => {
    if (modelBusy() && statusRef.current !== "ERROR") {
      patchControl({ diagOut: "Hay un modelo en proceso (" + statusRef.current + "); espera o descárgalo de memoria." });
      return;
    }
    const s = await scanCaches();
    let removed = 0;
    const rec = (keRef.current.recs || []).find((r) => r.id === defaultModelRef.current);
    const repo = rec ? rec.url.replace(/\/+$/, "") : null;
    for (const [g, entries] of s.groups) {
      if (repo && g !== repo) continue;
      for (const e of entries)
        if (!e.ok || e.status === 0 || e.size === 0) {
          try {
            if (await (await caches.open(e.cache)).delete(e.req)) removed++;
          } catch {
            /* ignore */
          }
        }
    }
    patchControl({
      diagOut:
        "Entradas inválidas eliminadas: " +
        removed +
        (repo ? "" : " (lista de modelos del worker no disponible: se revisaron todos los grupos)") +
        ". Reintentando UNA vez la carga de " +
        defaultModelRef.current +
        "…",
    });
    await refreshCache();
    setEngineError(null);
    setStatus("DOWNLOADING");
    setLabStatus("DOWNLOADING");
    getWorker().postMessage({ type: "load", model: defaultModelRef.current });
  }, [getWorker, modelBusy, patchControl, refreshCache]);

  const saveConfig = useCallback(async () => {
    const c = control;
    tokenSet(c.cfgToken.trim());
    const body = { backend: c.cfgBackend, base_url: c.cfgBaseUrl.trim(), model: c.cfgModel.trim() };
    if (c.cfgApiKey) body.api_key = c.cfgApiKey;
    try {
      const saved = await api("/config", { method: "POST", body: JSON.stringify(body) });
      patchControl({
        cfgApiKey: "",
        cfgKeyState: saved.api_key_set ? "(guardada: " + saved.api_key + ")" : "(sin definir)",
        cfgMsg: "Guardado en la memoria del servidor.",
      });
    } catch (e) {
      patchControl({ cfgMsg: "No se pudo guardar: " + e.message });
    }
    refreshStatus();
  }, [control, patchControl, refreshStatus]);

  const testConfig = useCallback(async () => {
    try {
      const m = await api("/models");
      const o = m.models.find((x) => x.backend === "openai-compatible");
      patchControl({
        cfgMsg: o
          ? "Proveedor: " +
            o.id +
            " · comprobación: " +
            o.provider_check +
            (m.backends["openai-compatible"].error ? "\n" + m.backends["openai-compatible"].error : "")
          : "OpenAI-compatible sin configurar (falta base URL y/o modelo).",
      });
    } catch (e) {
      patchControl({ cfgMsg: "Error: " + e.message });
    }
  }, [patchControl]);

  const recommend = useCallback(
    async (withWorker) => {
      if (withWorker && !keRef.current.recs) {
        patchControl({ recOut: "Obteniendo requisitos de WebLLM desde el worker…" });
        const w = getWorker();
        hookWorker();
        await new Promise((res) => {
          keRef.current.recsResolve = res;
          w.postMessage({ type: "models" });
          setTimeout(res, 15000);
        });
      }
      showRecommendation(keRef.current.recs);
    },
    [getWorker, hookWorker, patchControl, showRecommendation],
  );

  const applyRecommendation = useCallback(() => {
    if (!keRef.current.rec) return;
    if (modelBusy()) {
      patchControl({ recOut: control.recOut + "\n\nNo se puede cambiar de modelo con estado " + statusRef.current + ". Descárgalo de memoria antes." });
      return;
    }
    setDefaultModel(keRef.current.rec.id);
    patchControl({ recApplyHidden: true });
    setEngineError(null);
    refreshStatus();
  }, [control.recOut, modelBusy, patchControl, refreshStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLabStatus("OFFLINE");
      setCacheStatus("SIN VERIFICAR (se comprueba al cargar)");
      const hw = await detectHardware();
      if (cancelled) return;
      const probe = await probeApi();
      keRef.current.apiOk = probe.ok;
      keRef.current.version = probe.version;
      await loadConfig();
      await refreshCache();
      showRecommendation(null);
      await refreshStatus();
      console.info("[WebLLM] Modelo:", defaultModelRef.current);
      console.info("[WebLLM] Cache Storage:", "caches" in window);
      console.info("[WebLLM] Online:", navigator.onLine);
      console.info("[WebLLM] User Agent:", navigator.userAgent);
      if (!hw.webgpu) {
        /* error ya establecido en detectHardware */
      }
      const loop = async () => {
        while (!cancelled) {
          if (!keRef.current.apiOk) {
            await new Promise((r) => setTimeout(r, 5000));
            const again = await probeApi();
            keRef.current.apiOk = again.ok;
            keRef.current.version = again.version;
            if (again.ok) await loadConfig();
            continue;
          }
          try {
            const t = tokenGet();
            const r = await fetch("/bridge/events", { headers: t ? { Authorization: "Bearer " + t } : {} });
            if (!r.ok) throw new Error("HTTP " + r.status);
            const rd = r.body.getReader(),
              dec = new TextDecoder();
            let buf = "";
            keRef.current.lastReported = "";
            for (;;) {
              const { value, done } = await rd.read();
              if (done) break;
              buf += dec.decode(value, { stream: true });
              let i;
              while ((i = buf.indexOf("\n\n")) >= 0) {
                const block = buf.slice(0, i);
                buf = buf.slice(i + 2);
                const ev = /^event: (.+)$/m.exec(block),
                  dt = /^data: (.+)$/m.exec(block);
                if (!ev || !dt) continue;
                const data = JSON.parse(dt[1]);
                if (ev[1] === "hello") {
                  keRef.current.cid = data.client_id;
                  patchControl({ ksBridge: "CONECTADO", ksBridgeClass: GOOD });
                  reportState();
                } else if (ev[1] === "job") startJob(data);
                else if (ev[1] === "cancel" && keRef.current.job && keRef.current.job.jobId === data.job_id) {
                  getWorker().postMessage({ type: "cancel" });
                }
              }
            }
          } catch {
            /* se reintenta */
          }
          keRef.current.cid = null;
          patchControl({ ksBridge: "DESCONECTADO", ksBridgeClass: "text-slate-400" });
          await new Promise((r) => setTimeout(r, 3000));
        }
      };
      loop();
    })();
    const iv = setInterval(() => {
      hookWorker();
      reportState();
      refreshStatus();
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(iv);
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        keRef.current.hooked = null;
      }
    };
    // Arranque único: los handlers viven en refs y no deben re-montar worker/bridge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      status,
      generating,
      defaultModel,
      progress,
      engineError,
      labError,
      labStatus,
      cacheStatus,
      hardware,
      metrics,
      messages,
      control,
      sendEnabled,
      catalog: MODEL_CATALOG,
      downloadEnabled: Boolean(hardware.webgpu) && ["NOT_INSTALLED", "DOWNLOADED", "ERROR"].includes(status),
      unloadVisible: status === "READY" || status === "GENERATING",
      cancelVisible: generating || status === "GENERATING",
      downloadModel,
      unloadModel,
      cancelGenerate,
      sendChat,
      refreshCache,
      deleteCaches,
      runDiagnosis,
      fixAndRetry,
      saveConfig,
      testConfig,
      recommend,
      applyRecommendation,
      patchControl,
      chatReady: status === "READY" && sendEnabled && !generating,
    }),
    [
      status,
      generating,
      defaultModel,
      progress,
      engineError,
      labError,
      labStatus,
      cacheStatus,
      hardware,
      metrics,
      messages,
      control,
      sendEnabled,
      downloadModel,
      unloadModel,
      cancelGenerate,
      sendChat,
      refreshCache,
      deleteCaches,
      runDiagnosis,
      fixAndRetry,
      saveConfig,
      testConfig,
      recommend,
      applyRecommendation,
      patchControl,
    ],
  );

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}
