import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { KERNEL_PERSONALITY } from "./personality";
import { modelManager, IN_MEMORY } from "./modelManager";
import { detectHardware, emptyHardware, CLASS } from "./hardware";
import { getSetting, setSetting, loadChat, saveChat, clearChat } from "./storage";
import { api, probeApi, tokenGet, tokenSet } from "../api/client";
import { scanCaches, cacheApiSelfTest, classify as classifyDiag, formatCacheSummary, storageEstimateLine, fmtBytes } from "../api/cache";
import { parseKernelUrl } from "./kernelUrl";

const EngineContext = createContext(null);
export function useEngine() {
  const v = useContext(EngineContext);
  if (!v) throw new Error("useEngine debe usarse dentro de EngineProvider");
  return v;
}

const emptyMetrics = () => ({ tokens: "N/A", tps: "N/A", genTime: "N/A", firstTok: "N/A" });

const emptyControl = () => ({
  cacheSummary: "Sin escanear.",
  diagOut: "",
  cfgBackend: "auto",
  cfgBaseUrl: "",
  cfgApiKey: "",
  cfgModel: "",
  cfgToken: "",
  cfgKeyState: "",
  cfgMsg: "",
  cfgDisabled: false,
  ksBridge: "—",
});

export function EngineProvider({ children }) {
  const mm = useSyncExternalStore(modelManager.subscribe, modelManager.getSnapshot);

  // Arranque del motor (botón INICIAR MOTOR)
  const [startPhase, setStartPhase] = useState("IDLE"); // IDLE · STARTING · RUNNING · FAILED
  const [startError, setStartError] = useState(null);
  const [hardware, setHardware] = useState(emptyHardware);
  const [manualVram, setManualVramState] = useState(null);
  const [kernelUrl, setKernelUrlState] = useState("");
  const [kernelUrlError, setKernelUrlError] = useState(null);

  // Laboratorio
  const [messages, setMessages] = useState([]);
  const [labError, setLabError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [metrics, setMetrics] = useState(emptyMetrics);

  // Backend HTTP / diagnóstico
  const [control, setControl] = useState(emptyControl);
  const [apiState, setApiState] = useState({ ok: false, version: null });

  const keRef = useRef({ apiOk: false, cid: null, lastReported: "", job: null, diag: [], labGenId: null, started: false });
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const mmRef = useRef(mm);
  mmRef.current = mm;

  const patchControl = useCallback((partial) => setControl((prev) => ({ ...prev, ...partial })), []);

  /* ---------- ajustes persistidos (IndexedDB) + catálogo ---------- */
  useEffect(() => {
    let off = false;
    (async () => {
      const [url, vram, sel] = await Promise.all([getSetting("kernelUrl", ""), getSetting("vramGB", null), getSetting("selectedModel", null)]);
      if (off) return;
      setKernelUrlState(url || "");
      setManualVramState(vram);
      await modelManager.init();
      if (sel) modelManager.select(sel);
    })();
    return () => {
      off = true;
    };
  }, []);

  useEffect(() => {
    modelManager.setManual({ vramGB: manualVram || null });
  }, [manualVram]);

  const setManualVram = useCallback((gb) => {
    const n = gb === "" || gb == null ? null : Math.max(0.5, Math.min(256, Number(gb)));
    const v = Number.isFinite(n) ? n : null;
    setManualVramState(v);
    setSetting("vramGB", v);
  }, []);

  const saveKernelUrl = useCallback((raw) => {
    const r = parseKernelUrl(raw);
    if (!r.ok) {
      setKernelUrlError(r.error);
      return false;
    }
    setKernelUrlError(null);
    setKernelUrlState(r.url);
    setSetting("kernelUrl", r.url);
    return true;
  }, []);
  const clearKernelUrl = useCallback(() => {
    setKernelUrlState("");
    setSetting("kernelUrl", "");
  }, []);

  /* ---------- chat del laboratorio ---------- */
  const loadedId = mm.loadedId;
  const loadedStatus = loadedId ? mm.models[loadedId]?.status : null;

  useEffect(() => {
    let off = false;
    setGenerating(false);
    if (!loadedId) return undefined;
    loadChat(loadedId).then((m) => !off && setMessages(Array.isArray(m) ? m : []));
    return () => {
      off = true;
    };
  }, [loadedId]);

  useEffect(
    () =>
      modelManager.onMessage((d) => {
        const KE = keRef.current;
        if (d.type === "genstart" && d.id === KE.labGenId) setGenerating(true);
        else if (d.type === "token" && d.id === KE.labGenId) {
          setMessages((prev) => {
            const next = prev.slice();
            const last = next[next.length - 1];
            if (last && last.role === "assistant" && last.streaming) next[next.length - 1] = { ...last, content: last.content + d.delta };
            else next.push({ role: "assistant", content: d.delta, streaming: true });
            return next;
          });
        } else if (d.type === "usage" && d.id === KE.labGenId) {
          setMetrics((m) => ({
            tokens: d.completionTokens != null ? String(d.completionTokens) : m.tokens,
            genTime: d.genMs != null ? (d.genMs / 1000).toFixed(1) + " s" : m.genTime,
            firstTok: d.firstTokenMs != null ? d.firstTokenMs + " ms" : m.firstTok,
            tps: d.tps != null ? String(d.tps) : m.tps,
          }));
        } else if (d.type === "gendone" && d.id === KE.labGenId) {
          setGenerating(false);
          KE.labGenId = null;
          setMessages((prev) => {
            const next = prev.map((m) => (m.streaming ? { role: m.role, content: m.content } : m));
            if (mmRef.current.loadedId) saveChat(mmRef.current.loadedId, next);
            return next;
          });
        } else if (d.type === "error" && d.scope === "generate") {
          setGenerating(false);
          KE.labGenId = null;
          setLabError("Fallo en la generación: " + d.message);
          setMessages((prev) => prev.map((m) => (m.streaming ? { role: m.role, content: m.content } : m)));
        }
      }),
    [],
  );

  const sendChat = useCallback((text) => {
    const trimmed = text.trim();
    const m = mmRef.current;
    const id = m.loadedId;
    if (!trimmed || !id || m.models[id]?.status !== "READY" || keRef.current.job) return false;
    const history = [...messagesRef.current, { role: "user", content: trimmed }];
    setMessages(history);
    setLabError(null);
    const genId = Date.now();
    keRef.current.labGenId = genId;
    const payload = [{ role: "system", content: KERNEL_PERSONALITY.systemPrompt }, ...history.slice(-12).map(({ role, content }) => ({ role, content }))];
    modelManager.generate({ id: genId, model: id, messages: payload });
    return true;
  }, []);

  const cancelGenerate = useCallback(() => modelManager.cancelGenerate(), []);
  const resetChat = useCallback(() => {
    setMessages([]);
    setLabError(null);
    if (mmRef.current.loadedId) clearChat(mmRef.current.loadedId);
  }, []);

  /* ---------- acciones de modelo (todas pasan por ModelManager) ---------- */
  const selectModel = useCallback((id) => {
    modelManager.select(id);
    setSetting("selectedModel", id);
  }, []);
  const download = useCallback((id) => modelManager.download(id), []);
  const unload = useCallback(() => modelManager.unload(), []);
  const cancelDownload = useCallback(() => modelManager.cancel(), []);
  const [formatResult, setFormatResult] = useState(null);
  const deleteModel = useCallback(async (id) => {
    const r = await modelManager.deleteModel(id);
    setFormatResult({ id, ...r });
    return r;
  }, []);

  /* ---------- INICIAR MOTOR ---------- */
  const startEngine = useCallback(async () => {
    if (keRef.current.started) return;
    setStartPhase("STARTING");
    setStartError(null);
    try {
      const hw = await detectHardware();
      setHardware(hw);
      modelManager.setHardware(hw, { vramGB: manualVram || null });
      await modelManager.init();
      await Promise.all(modelManager.getSnapshot().catalog.featured.map((m) => modelManager.refreshCache(m.id)));
      keRef.current.started = true;
      setStartPhase("RUNNING");
    } catch (e) {
      setStartError("No se pudo iniciar el motor: " + ((e && e.message) || e));
      setStartPhase("FAILED");
    }
  }, [manualVram]);

  /* ---------- API HTTP de K.ENGINE (server.js), opcional ---------- */
  const loadConfig = useCallback(async () => {
    if (!keRef.current.apiOk) {
      patchControl({ cfgMsg: "Sin API: arranca con `npm run dev` (o `node server.js`) para configurar el backend.", cfgDisabled: true });
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

  useEffect(() => {
    let off = false;
    (async () => {
      const probe = await probeApi();
      if (off) return;
      keRef.current.apiOk = probe.ok;
      setApiState(probe);
      await loadConfig();
    })();
    return () => {
      off = true;
    };
  }, [loadConfig]);

  const saveConfig = useCallback(async () => {
    const c = control;
    tokenSet(c.cfgToken.trim());
    const body = { backend: c.cfgBackend, base_url: c.cfgBaseUrl.trim(), model: c.cfgModel.trim() };
    if (c.cfgApiKey) body.api_key = c.cfgApiKey;
    try {
      const saved = await api("/config", { method: "POST", body: JSON.stringify(body) });
      patchControl({ cfgApiKey: "", cfgKeyState: saved.api_key_set ? "(guardada: " + saved.api_key + ")" : "(sin definir)", cfgMsg: "Guardado en la memoria del servidor." });
    } catch (e) {
      patchControl({ cfgMsg: "No se pudo guardar: " + e.message });
    }
  }, [control, patchControl]);

  const testConfig = useCallback(async () => {
    try {
      const m = await api("/models");
      const o = m.models.find((x) => x.backend === "openai-compatible");
      patchControl({
        cfgMsg: o
          ? "Proveedor: " + o.id + " · comprobación: " + o.provider_check + (m.backends["openai-compatible"].error ? "\n" + m.backends["openai-compatible"].error : "")
          : "OpenAI-compatible sin configurar (falta base URL y/o modelo).",
      });
    } catch (e) {
      patchControl({ cfgMsg: "Error: " + e.message });
    }
  }, [patchControl]);

  /* ---------- puente navegador ↔ server.js (backend "webllm" de la API) ---------- */
  const reportState = useCallback(async () => {
    const KE = keRef.current;
    if (!KE.apiOk || !KE.cid) return;
    const m = mmRef.current;
    const id = m.loadedId;
    const st = id ? m.models[id]?.status : "NOT_INSTALLED";
    const key = st + "|" + id;
    if (key === KE.lastReported) return;
    KE.lastReported = key;
    try {
      await api("/bridge/state", {
        method: "POST",
        body: JSON.stringify({ client_id: KE.cid, loaded_model: st === "READY" || st === "GENERATING" ? id : null, state: st === "GENERATING" ? "READY" : st }),
      });
    } catch {
      KE.lastReported = "";
    }
  }, []);

  useEffect(() => {
    reportState();
  }, [loadedId, loadedStatus, reportState]);

  useEffect(() => {
    if (startPhase !== "RUNNING") return undefined;
    let cancelled = false;
    const KE = keRef.current;

    const flushJob = async (final) => {
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
    };
    const offMsg = modelManager.onMessage((d) => {
      const j = KE.job;
      if (!j) return;
      if (d.type === "token" && d.id === j.id) {
        j.buf += d.delta;
        if (!j.timer) j.timer = setTimeout(() => flushJob(false), 80);
      } else if (d.type === "gendone" && d.id === j.id) flushJob(true);
      else if (d.type === "error" && d.scope === "generate") {
        j.err = d.message;
        flushJob(true);
      }
    });
    const startJob = (job) => {
      const m = mmRef.current;
      const id = m.loadedId;
      const st = id ? m.models[id]?.status : null;
      if (st !== "READY" || KE.job || KE.labGenId) {
        api("/bridge/chunk", {
          method: "POST",
          body: JSON.stringify({ client_id: KE.cid, job_id: job.job_id, error: "La pestaña K.ENGINE no está lista (estado: " + (st || "sin modelo") + ")" }),
        }).catch(() => {});
        return;
      }
      KE.job = { jobId: job.job_id, id: 1e9 + Math.floor(Math.random() * 1e9), buf: "", timer: null, err: null };
      modelManager.generate({ id: KE.job.id, model: id, messages: job.messages, max_tokens: job.max_tokens });
    };

    (async () => {
      while (!cancelled) {
        if (!KE.apiOk) {
          await new Promise((r) => setTimeout(r, 5000));
          const again = await probeApi();
          KE.apiOk = again.ok;
          setApiState(again);
          if (again.ok) await loadConfig();
          continue;
        }
        try {
          const t = tokenGet();
          const r = await fetch("/bridge/events", { headers: t ? { Authorization: "Bearer " + t } : {} });
          if (!r.ok) throw new Error("HTTP " + r.status);
          const rd = r.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          KE.lastReported = "";
          for (;;) {
            const { value, done } = await rd.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf("\n\n")) >= 0) {
              const block = buf.slice(0, i);
              buf = buf.slice(i + 2);
              const ev = /^event: (.+)$/m.exec(block);
              const dt = /^data: (.+)$/m.exec(block);
              if (!ev || !dt) continue;
              const data = JSON.parse(dt[1]);
              if (ev[1] === "hello") {
                KE.cid = data.client_id;
                patchControl({ ksBridge: "CONECTADO" });
                reportState();
              } else if (ev[1] === "job") startJob(data);
              else if (ev[1] === "cancel" && KE.job && KE.job.jobId === data.job_id) modelManager.cancelGenerate();
            }
          }
        } catch {
          /* se reintenta */
        }
        KE.cid = null;
        patchControl({ ksBridge: "DESCONECTADO" });
        await new Promise((r) => setTimeout(r, 3000));
      }
    })();
    return () => {
      cancelled = true;
      offMsg();
    };
  }, [startPhase, loadConfig, patchControl, reportState]);

  /* ---------- caché (solo lectura) y diagnóstico de descarga ---------- */
  const refreshCache = useCallback(async () => {
    try {
      const s = await scanCaches();
      patchControl({ cacheSummary: formatCacheSummary(s, await storageEstimateLine()) });
      return s;
    } catch (e) {
      patchControl({ cacheSummary: "Error al escanear la caché: " + ((e && e.message) || e) });
      return null;
    }
  }, [patchControl]);

  useEffect(() => {
    refreshCache();
  }, [refreshCache, mm.models]);

  const runDiagnosis = useCallback(async () => {
    const KE = keRef.current;
    KE.diag = [];
    patchControl({ diagOut: "Comprobando Cache API y recursos…" });
    const st = await cacheApiSelfTest();
    let est = "";
    try {
      const e = await navigator.storage.estimate();
      est = "\nAlmacenamiento: usado " + fmtBytes(e.usage || 0) + " / cuota " + fmtBytes(e.quota || 0);
    } catch {
      /* ignore */
    }
    const result = await new Promise((res) => {
      const t = setTimeout(() => {
        off();
        res({ timeout: true });
      }, 120000);
      const off = modelManager.onMessage((d) => {
        if (d.type === "diag") {
          KE.diag.push(d.item);
          patchControl({ diagOut: KE.diag.map((i) => (i.ok ? "OK   " : "FALLA") + " " + (i.status || "") + " " + i.url + (i.error ? "\n       " + i.error : "")).join("\n") });
        } else if (d.type === "diag_done") {
          clearTimeout(t);
          off();
          res(d);
        } else if (d.type === "error" && d.scope === "diagnose") {
          clearTimeout(t);
          off();
          res({ workerFailed: true, message: d.message });
        }
      });
      modelManager.post({ type: "diagnose", model: mmRef.current.selectedId });
    });
    const head = "Origen: " + location.origin + " · Cache API: " + (st.ok ? "OK" : "FALLA") + " (" + st.detail + ")" + est + "\n";
    const verdict = result.workerFailed
      ? "El worker no pudo ejecutar el diagnóstico: " + result.message
      : result.timeout
        ? "El worker no respondió al diagnóstico."
        : classifyDiag(KE.diag, st);
    patchControl({
      diagOut: head + "\n" + KE.diag.map((i) => (i.ok ? "OK   " : "FALLA") + " " + (i.status || "") + " " + i.url + (i.error ? "\n       " + i.error : "")).join("\n") + "\n\n" + verdict,
    });
  }, [patchControl]);

  /* ---------- derivados ---------- */
  const statusLines = useMemo(() => {
    const id = loadedId;
    const st = id ? mm.models[id]?.status : null;
    const ready = st === "READY" || st === "GENERATING";
    return {
      engine: startPhase !== "RUNNING" ? "○ DETENIDO" : ready ? "● ONLINE" : "○ SIN MODELO CARGADO",
      model: ready ? id : "— (ninguno cargado)",
      webgpu: !hardware.checked
        ? "SIN COMPROBAR (pulsa INICIAR MOTOR)"
        : hardware.adapter
          ? "READY" + (hardware.shaderF16 ? " · shader-f16" : " · sin shader-f16")
          : "NO DISPONIBLE",
      webgpuOk: hardware.checked ? hardware.adapter : null,
      api: apiState.ok ? "READY (v" + apiState.version + ")" : "NO DISPONIBLE (UI servida sin server.js)",
      apiOk: apiState.ok,
    };
  }, [loadedId, mm.models, startPhase, hardware, apiState]);

  const cls = useCallback((id) => mmRef.current && modelManager.classify(id), []);
  const classes = useMemo(() => {
    const out = {};
    for (const m of mm.catalog.models.length ? mm.catalog.featured : []) out[m.id] = modelManager.classify(m.id);
    const sel = mm.selectedId;
    if (sel && !out[sel]) out[sel] = modelManager.classify(sel);
    return out;
    // hardware y manualVram cambian la clasificación
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mm.catalog, mm.selectedId, hardware, manualVram]);

  const value = useMemo(
    () => ({
      // modelos
      ready: mm.ready,
      initError: mm.initError,
      catalog: mm.catalog,
      models: mm.models,
      selectedId: mm.selectedId,
      loadedId,
      opKind: mm.opKind,
      opId: mm.opId,
      classes,
      classify: cls,
      selectModel,
      download,
      retry: download,
      cancelDownload,
      unload,
      deleteModel,
      formatResult,
      // arranque
      startPhase,
      startError,
      startEngine,
      hardware,
      manualVram,
      setManualVram,
      kernelUrl,
      kernelUrlError,
      saveKernelUrl,
      clearKernelUrl,
      // laboratorio
      messages,
      sendChat,
      cancelGenerate,
      resetChat,
      labError,
      generating,
      metrics,
      chatReady: Boolean(loadedId) && mm.models[loadedId]?.status === "READY" && !generating,
      inMemory: Boolean(loadedId) && IN_MEMORY.includes(mm.models[loadedId]?.status),
      // backend / panel
      control,
      patchControl,
      saveConfig,
      testConfig,
      refreshCache,
      runDiagnosis,
      statusLines,
      CLASS,
    }),
    [mm, loadedId, classes, cls, selectModel, download, cancelDownload, unload, deleteModel, formatResult, startPhase, startError, startEngine, hardware, manualVram, setManualVram, kernelUrl, kernelUrlError, saveKernelUrl, clearKernelUrl, messages, sendChat, cancelGenerate, resetChat, labError, generating, metrics, control, patchControl, saveConfig, testConfig, refreshCache, runDiagnosis, statusLines],
  );

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}
