import { useEffect, useState } from "react";
import { useEngine } from "../engine/EngineProvider";

/** INICIAR MOTOR → inicialización (WebGPU + caché) → INTRODUCIR URL DE K.E.R.N.E.L (nunca se conecta sola). */
export function StartPanel() {
  const { startPhase, startError, startEngine, hardware, kernelUrl, kernelUrlError, saveKernelUrl, clearKernelUrl } = useEngine();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setDraft(kernelUrl);
  }, [kernelUrl]);

  const showUrl = startPhase === "RUNNING";
  return (
    <div className="mt-8 max-w-2xl" data-testid="start-panel" data-phase={startPhase}>
      {startPhase !== "RUNNING" ? (
        <button
          data-testid="start-engine-btn"
          className="inline-flex items-center gap-2 bg-volt text-ink-950 font-semibold px-6 py-3 rounded-md hover:bg-emerald-300 transition disabled:opacity-50"
          disabled={startPhase === "STARTING"}
          onClick={startEngine}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          {startPhase === "STARTING" ? "INICIALIZANDO…" : startPhase === "FAILED" ? "REINTENTAR INICIO" : "INICIAR MOTOR"}
        </button>
      ) : (
        <p data-testid="engine-started" className="font-mono text-xs text-volt uppercase tracking-wider">
          ● Motor iniciado · WebGPU: {hardware.adapter ? "disponible" : "NO disponible"}
        </p>
      )}
      {startError ? <p className="mt-3 font-mono text-xs text-red2">{startError}</p> : null}
      {showUrl && !hardware.adapter ? (
        <p data-testid="webgpu-problems" className="mt-3 font-mono text-xs text-amber2 whitespace-pre-wrap">
          Sin WebGPU utilizable, no se cargará ningún modelo:{"\n"}
          {hardware.problems.join("\n")}
        </p>
      ) : null}

      {showUrl ? (
        <div className="mt-6 bg-ink-900 border border-ink-600 rounded-lg p-5" data-testid="kernel-url-panel">
          <label htmlFor="kernelUrl" className="block font-mono text-[11px] uppercase tracking-widest text-volt mb-2">
            INTRODUCIR URL DE K.E.R.N.E.L
          </label>
          {kernelUrl && !editing ? (
            <div className="flex flex-wrap items-center gap-3">
              <span data-testid="kernel-url-saved" className="font-mono text-sm text-slate-200 break-all">
                {kernelUrl}
              </span>
              <a href={kernelUrl} target="_blank" rel="noopener noreferrer" className="border border-volt/60 text-volt font-mono text-xs uppercase px-3 py-1.5 rounded hover:bg-volt hover:text-ink-950">
                Abrir KERNEL ↗
              </a>
              <button className="border border-ink-500 text-slate-300 font-mono text-xs uppercase px-3 py-1.5 rounded hover:bg-ink-800" onClick={() => setEditing(true)}>
                Cambiar
              </button>
              <button className="border border-red2/50 text-red2 font-mono text-xs uppercase px-3 py-1.5 rounded hover:bg-red2/10" onClick={clearKernelUrl}>
                Quitar
              </button>
            </div>
          ) : (
            <form
              className="flex flex-col sm:flex-row gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (saveKernelUrl(draft)) setEditing(false);
              }}
            >
              <input
                id="kernelUrl"
                data-testid="kernel-url-input"
                type="text"
                inputMode="url"
                autoComplete="off"
                placeholder="https://… (la URL de tu interfaz KERNEL)"
                className="flex-1 bg-ink-950 border border-ink-600 rounded px-3 py-2 text-slate-200 font-mono text-sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button data-testid="kernel-url-save" type="submit" className="bg-volt text-ink-950 font-semibold px-4 py-2 rounded-md hover:bg-emerald-300">
                GUARDAR
              </button>
              {editing ? (
                <button type="button" className="border border-ink-500 text-slate-300 px-4 py-2 rounded-md" onClick={() => setEditing(false)}>
                  CANCELAR
                </button>
              ) : null}
            </form>
          )}
          {kernelUrlError ? (
            <p data-testid="kernel-url-error" className="mt-2 font-mono text-xs text-red2">
              {kernelUrlError}
            </p>
          ) : null}
          <p className="mt-3 text-[11px] text-slate-500">
            Solo se guarda en este navegador (IndexedDB). K.ENGINE no se conecta a ninguna URL por sí solo; podrás cambiarla cuando quieras.
          </p>
        </div>
      ) : null}
    </div>
  );
}
