import { Reveal } from "./Reveal";
import { Chat } from "./Chat";
import { useEngine } from "../engine/EngineProvider";

export function ModelLab() {
  const { engineError, downloadModel, unloadModel, cancelGenerate, status, cacheStatus, hardware, metrics, downloadEnabled, unloadVisible, cancelVisible } =
    useEngine();
  return (
    <section id="lab" className="py-20 lg:py-28 border-b border-ink-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-3xl">
          <p className="font-mono text-volt text-xs uppercase tracking-[0.25em] mb-3">// Model Lab</p>
          <h2 className="font-display font-bold text-3xl lg:text-4xl text-white">Laboratorio de modelos</h2>
          <p className="mt-4 text-slate-400 leading-relaxed">
            Prueba cada modelo de forma totalmente aislada antes de conectarlo a KERNEL. Si la carga falla, usa primero la{" "}
            <a href="/webllm-test.html" className="text-volt underline">
              página de diagnóstico mínima de WebLLM
            </a>
            : sin K.ENGINE, sin workers, sin fetch manual, solo prebuiltAppConfig + CreateMLCEngine.
          </p>
        </Reveal>
        <Reveal className="mt-12 grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-ink-900 border border-ink-600 rounded-lg p-6">
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-slate-500 mb-4">Model Manager</h3>
              <div
                id="engineModelError"
                className={`${engineError ? "" : "hidden"} mb-4 font-mono text-xs text-red2 bg-red2/10 border border-red2/30 rounded p-3 break-words`}
              >
                {engineError}
              </div>
              <button
                id="downloadModelBtn"
                className="w-full bg-volt text-ink-950 font-semibold text-sm px-4 py-3 rounded-md hover:bg-emerald-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!downloadEnabled}
                onClick={downloadModel}
              >
                DESCARGAR MODELO
              </button>
              <button
                id="unloadModelBtn"
                className={`${unloadVisible ? "" : "hidden"} w-full mt-2 border border-red2/50 text-red2 font-mono text-xs uppercase tracking-wider px-4 py-2.5 rounded-md hover:bg-red2/10 transition`}
                onClick={unloadModel}
              >
                Descargar de memoria
              </button>
              <button
                id="cancelBtn"
                className={`${cancelVisible ? "" : "hidden"} w-full mt-2 border border-amber2/50 text-amber2 font-mono text-xs uppercase tracking-wider px-4 py-2.5 rounded-md hover:bg-amber2/10 transition`}
                onClick={cancelGenerate}
              >
                Cancelar generación
              </button>
              <div className="mt-5 font-mono text-[11px] text-slate-500 space-y-1.5">
                <p>
                  ENGINE STATUS: <span id="engineStatus" className="text-slate-300">{status}</span>
                </p>
                <p>
                  CACHE: <span id="cacheStatus" className="text-slate-300">{cacheStatus}</span>
                </p>
                <p>
                  WEBGPU: <span id="webgpuStatus" className={hardware.webgpuClass}>{hardware.webgpuLabel}</span>
                </p>
                <p>
                  HARDWARE CLASS: <span id="hwClassStatus" className={hardware.hwClassStatusClass}>{hardware.hwClassStatus}</span>
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
                <div className="flex justify-between">
                  <dt>CONTEXT SIZE</dt>
                  <dd id="mCtx" className="text-slate-200">
                    {metrics.ctx}
                  </dd>
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
