import { Reveal } from "./Reveal";
import { Chat } from "./Chat";
import { useEngine } from "../engine/EngineProvider";

import { STATUS_LABELS, pct } from "../engine/status";

export function ModelLab() {
  const { models, selectedId, loadedId, classes, startPhase, opKind, opId, download, unload, cancelDownload, cancelGenerate, generating, metrics, hardware, statusLines } =
    useEngine();
  const id = loadedId || selectedId;
  const m = models[id] || { status: "NOT_DOWNLOADED" };
  const cls = classes[id];
  const [, label] = STATUS_LABELS[m.status] || STATUS_LABELS.NOT_DOWNLOADED;
  const started = startPhase === "RUNNING";
  const inMemory = m.status === "READY" || m.status === "GENERATING";
  const working = ["DOWNLOADING", "LOADING", "VERIFYING", "UNLOADING", "DELETING"].includes(m.status);
  const percent = pct(m.progress);
  const mainLabel = !started
    ? "INICIA EL MOTOR"
    : m.status === "DOWNLOADING"
      ? (percent ?? 0) + "%"
      : m.status === "LOADING"
        ? "CARGANDO " + (percent ?? 0) + "%"
        : m.status === "VERIFYING"
          ? "VERIFICANDO"
          : inMemory
            ? "READY"
            : m.status === "DOWNLOADED"
              ? "CARGAR MODELO"
              : m.status === "ERROR"
                ? "REINTENTAR"
                : "DESCARGAR MODELO";
  const mainDisabled = !started || working || inMemory || Boolean(opKind && opId !== id) || m.status === "CHECKING" || Boolean(cls && cls.blocking);
  return (
    <section id="lab" className="py-20 lg:py-28 border-b border-ink-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-3xl">
          <p className="font-mono text-volt text-xs uppercase tracking-[0.25em] mb-3">// Model Lab</p>
          <h2 className="font-display font-bold text-3xl lg:text-4xl text-white">Laboratorio de modelos</h2>
          <p className="mt-4 text-slate-400 leading-relaxed">
            Prueba un modelo de forma aislada, con la personalidad de KERNEL, antes de conectarlo a nada. Las respuestas las genera el modelo local en tu GPU (WebLLM +
            WebGPU): ninguna API externa. Si la carga falla, usa el diagnóstico de descarga del panel de control.
          </p>
        </Reveal>
        <Reveal className="mt-12 grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-ink-900 border border-ink-600 rounded-lg p-6">
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-slate-500 mb-2">Modelo del laboratorio</h3>
              <p data-testid="lab-model-id" className="font-mono text-xs text-slate-200 break-all mb-4">
                {id}
              </p>
              {m.error ? (
                <div id="engineModelError" className="mb-4 font-mono text-xs text-red2 bg-red2/10 border border-red2/30 rounded p-3 break-words whitespace-pre-wrap">
                  {m.error}
                </div>
              ) : null}
              <button
                id="downloadModelBtn"
                data-testid="lab-main-btn"
                className="w-full bg-volt text-ink-950 font-semibold text-sm px-4 py-3 rounded-md hover:bg-emerald-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={mainDisabled}
                onClick={() => download(id)}
              >
                {mainLabel}
              </button>
              {m.status === "DOWNLOADING" || m.status === "LOADING" ? (
                <button className="w-full mt-2 border border-amber2/50 text-amber2 font-mono text-xs uppercase tracking-wider px-4 py-2.5 rounded-md hover:bg-amber2/10 transition" onClick={cancelDownload}>
                  Cancelar descarga
                </button>
              ) : null}
              <button
                id="unloadModelBtn"
                data-testid="lab-unload-btn"
                className={`${inMemory ? "" : "hidden"} w-full mt-2 border border-red2/50 text-red2 font-mono text-xs uppercase tracking-wider px-4 py-2.5 rounded-md hover:bg-red2/10 transition disabled:opacity-40`}
                disabled={generating}
                onClick={unload}
              >
                Liberar memoria
              </button>
              <button
                id="cancelBtn"
                className={`${generating ? "" : "hidden"} w-full mt-2 border border-amber2/50 text-amber2 font-mono text-xs uppercase tracking-wider px-4 py-2.5 rounded-md hover:bg-amber2/10 transition`}
                onClick={cancelGenerate}
              >
                Cancelar generación
              </button>
              <div className="mt-5 font-mono text-[11px] text-slate-500 space-y-1.5">
                <p>
                  ESTADO: <span id="engineStatus" data-testid="lab-status" className="text-slate-300">{label}</span>
                </p>
                <p>
                  WEBGPU: <span id="webgpuStatus" className={hardware.adapter ? "text-volt" : "text-red2"}>{statusLines.webgpu}</span>
                </p>
                <p>
                  COMPATIBILIDAD: <span className="text-slate-300">{cls ? cls.level : "—"}</span>
                </p>
              </div>
            </div>
            <div className="bg-ink-900 border border-ink-600 rounded-lg p-6">
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-slate-500 mb-4">Métricas (reales)</h3>
              <dl className="font-mono text-xs space-y-2 text-slate-400">
                <div className="flex justify-between">
                  <dt>TOKENS GENERATED</dt>
                  <dd id="mTokens" className="text-slate-200">
                    {metrics.tokens}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>TOKENS / SECOND</dt>
                  <dd id="mTps" className="text-slate-200">
                    {metrics.tps}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>GENERATION TIME</dt>
                  <dd id="mGenTime" className="text-slate-200">
                    {metrics.genTime}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>FIRST TOKEN TIME</dt>
                  <dd id="mFirstTok" className="text-slate-200">
                    {metrics.firstTok}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>BACKEND</dt>
                  <dd className="text-slate-200">WebLLM</dd>
                </div>
              </dl>
            </div>
          </div>
          <Chat />
        </Reveal>
      </div>
    </section>
  );
}
