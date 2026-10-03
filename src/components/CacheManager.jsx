import { useState } from "react";
import { useEngine } from "../engine/EngineProvider";

export function CacheManager() {
  const { control, refreshCache, runDiagnosis, deleteModel, selectedId, loadedId } = useEngine();
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState(null);

  const handleClear = async () => {
    if (!selectedId) return;
    if (loadedId === selectedId) {
      setClearResult({ ok: false, error: "Libera el modelo de memoria antes de limpiar la caché." });
      return;
    }
    setClearing(true);
    setClearResult(null);
    const r = await deleteModel(selectedId);
    setClearing(false);
    setClearResult(r);
  };

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

      <div className="mt-4 border-t border-ink-700 pt-4">
        <h4 className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">Limpiar caché del modelo</h4>
        <p className="text-slate-500 text-xs mb-2">
          Modelo seleccionado: <span className="text-slate-300 font-mono break-all">{selectedId}</span>
        </p>
        <button
          data-testid="clear-cache-btn"
          className="w-full border border-red2/50 text-red2 uppercase tracking-wider px-3 py-2.5 rounded-md hover:bg-red2/10 transition disabled:opacity-40"
          disabled={clearing || !selectedId || loadedId === selectedId}
          onClick={handleClear}
        >
          {clearing ? "ELIMINANDO…" : "LIMPIAR CACHÉ DEL MODELO"}
        </button>
        {clearResult ? (
          <p data-testid="clear-cache-result" className={`mt-2 font-mono text-xs ${clearResult.ok ? "text-volt" : "text-red2"}`}>
            {clearResult.ok ? "Datos eliminados." + (clearResult.freedBytes != null ? " Liberado ≈ " + (clearResult.freedBytes / 1024 / 1024).toFixed(1) + " MB." : "") : clearResult.error}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] text-slate-500">
          Elimina solo los datos del modelo seleccionado (deleteModelAllInfoInCache de WebLLM). No borra otras cachés, ni IndexedDB, ni configuración.
        </p>
      </div>

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
