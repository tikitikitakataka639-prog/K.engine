import { useEngine } from "../engine/EngineProvider";

export function CacheManager() {
  const { control, refreshCache, deleteCaches, runDiagnosis, fixAndRetry } = useEngine();
  return (
    <div className="bg-ink-900 border border-ink-600 rounded-lg p-6">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-500 mb-4">Caché de modelos (Cache API)</h3>
      <p id="cacheSummary" className="text-slate-300 mb-3">
        {control.cacheSummary}
      </p>
      <div id="cacheBarWrap" className={`${control.cacheBarWrap ? "" : "hidden"} mb-3`}>
        <p id="cacheTitle" className="text-amber2 uppercase tracking-widest mb-2">
          {control.cacheTitle}
        </p>
        <div className="h-2.5 bg-ink-800 rounded overflow-hidden">
          <div id="cacheBar" className="h-full bg-volt" style={{ width: control.cacheBar + "%" }} />
        </div>
        <p id="cachePct" className="mt-2 text-slate-200">
          {control.cachePct}
        </p>
        <p id="cacheDetail" className="mt-1 text-slate-400 break-words">
          {control.cacheDetail}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          id="cacheScan"
          className="flex-1 border border-ink-500 text-slate-300 uppercase tracking-wider px-3 py-2.5 rounded-md hover:bg-ink-800 transition"
          onClick={refreshCache}
        >
          ESCANEAR
        </button>
        <button
          id="cacheDelete"
          className="flex-1 border border-red2/50 text-red2 uppercase tracking-wider px-3 py-2.5 rounded-md hover:bg-red2/10 transition disabled:opacity-40"
          disabled={control.cacheDeleteDisabled}
          onClick={deleteCaches}
        >
          ELIMINAR CACHÉ DE MODELOS
        </button>
      </div>
      <p className="mt-3 text-slate-500">
        Solo borra cachés de WebLLM/K.ENGINE (nombres que empiezan por <span className="text-slate-300">webllm</span> o{" "}
        <span className="text-slate-300">kengine</span>). Con un modelo cargado o descargándose se rechaza.
      </p>
      <h3 className="mt-8 text-[11px] uppercase tracking-widest text-slate-500 mb-3">Diagnóstico de descarga</h3>
      <button
        id="diagBtn"
        className="w-full border border-amber2/50 text-amber2 uppercase tracking-wider px-4 py-2.5 rounded-md hover:bg-amber2/10 transition"
        onClick={runDiagnosis}
      >
        DIAGNOSTICAR RECURSOS
      </button>
      <button
        id="diagFix"
        className={`${control.diagFixHidden ? "hidden" : ""} mt-2 w-full border border-ink-500 text-slate-300 uppercase tracking-wider px-4 py-2 rounded-md hover:bg-ink-800 transition`}
        onClick={fixAndRetry}
      >
        LIMPIAR ENTRADAS CORRUPTAS Y REINTENTAR
      </button>
      <pre id="diagOut" className="mt-3 whitespace-pre-wrap break-all text-slate-400 max-h-72 overflow-y-auto">
        {control.diagOut}
      </pre>
    </div>
  );
}
