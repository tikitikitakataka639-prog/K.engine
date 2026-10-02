import { useEngine } from "../engine/EngineProvider";

export function CacheManager() {
  const { control, refreshCache, runDiagnosis } = useEngine();
  return (
    <div className="bg-ink-900 border border-ink-600 rounded-lg p-6">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-500 mb-4">Caché de modelos (Cache API)</h3>
      <p id="cacheSummary" className="text-slate-300 mb-3">
        {control.cacheSummary}
      </p>
      <button
        id="cacheScan"
        className="w-full border border-ink-500 text-slate-300 uppercase tracking-wider px-3 py-2.5 rounded-md hover:bg-ink-800 transition"
        onClick={refreshCache}
      >
        ESCANEAR
      </button>
      <p className="mt-3 text-slate-500">
        Solo lectura. Para eliminar los datos de un modelo usa <span className="text-slate-300">FORMATEAR MODELO</span> en su tarjeta del catálogo: borra solo ese
        modelo (deleteModelAllInfoInCache de WebLLM), no toda la Cache API.
      </p>
      <h3 className="mt-8 text-[11px] uppercase tracking-widest text-slate-500 mb-3">Diagnóstico de descarga</h3>
      <button
        id="diagBtn"
        className="w-full border border-amber2/50 text-amber2 uppercase tracking-wider px-4 py-2.5 rounded-md hover:bg-amber2/10 transition"
        onClick={runDiagnosis}
      >
        DIAGNOSTICAR RECURSOS
      </button>
      <pre id="diagOut" className="mt-3 whitespace-pre-wrap break-all text-slate-400 max-h-72 overflow-y-auto">
        {control.diagOut}
      </pre>
    </div>
  );
}
