import { useState } from "react";
import { useEngine } from "../engine/EngineProvider";
import { STATUS_LABELS, CLASS_STYLE, pct } from "../engine/status";
import { fmtMB } from "../engine/hardware";
import { fmtBytes } from "../api/cache";

/** Tarjeta de un modelo. Toda la lógica vive en ModelManager; aquí solo se pinta y se llama a acciones. */
export function ModelCard({ model }) {
  const { models, selectedId, loadedId, opKind, opId, classes, startPhase, selectModel, download, cancelDownload, unload, deleteModel, formatResult } = useEngine();
  const [confirming, setConfirming] = useState(false);
  const m = models[model.id] || { status: "CHECKING" };
  const cls = classes[model.id];
  const [dot, label] = STATUS_LABELS[m.status] || STATUS_LABELS.NOT_DOWNLOADED;
  const started = startPhase === "RUNNING";
  const busyElsewhere = Boolean(opKind) && opId !== model.id;
  const percent = pct(m.progress);
  const selected = selectedId === model.id;
  const inMemory = m.status === "READY" || m.status === "GENERATING" || m.status === "CANCELLING";
  const working = ["DOWNLOADING", "LOADING", "VERIFYING", "UNLOADING", "DELETING"].includes(m.status);
  const hardBlock = cls && cls.level === "NO COMPATIBLE";
  const lastDelete = formatResult && formatResult.id === model.id ? formatResult : null;

  let mainLabel;
  if (!started) mainLabel = "INICIA EL MOTOR";
  else if (m.status === "DOWNLOADING") mainLabel = percent != null ? percent + "%" : "…";
  else if (m.status === "LOADING") mainLabel = "CARGANDO " + (percent ?? 0) + "%";
  else if (m.status === "VERIFYING") mainLabel = "VERIFICANDO";
  else if (inMemory) mainLabel = "READY";
  else if (m.status === "DOWNLOADED") mainLabel = "CARGAR";
  else if (m.status === "ERROR") mainLabel = "REINTENTAR";
  else if (m.status === "UNLOADING") mainLabel = "LIBERANDO…";
  else if (m.status === "DELETING") mainLabel = "ELIMINANDO…";
  else if (m.status === "INCOMPATIBLE") mainLabel = "NO COMPATIBLE";
  else mainLabel = "DESCARGAR";

  const mainDisabled = !started || working || inMemory || busyElsewhere || m.status === "CHECKING" || (cls && cls.blocking);

  return (
    <article
      className={`model-card bg-ink-900 border ${selected ? "border-volt/50" : "border-ink-600"} rounded-lg p-6`}
      data-testid="model-card"
      data-model-id={model.id}
      data-status={m.status}
    >
      <div className="flex flex-wrap items-center gap-2">
        {model.featured ? <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-ink-700 text-slate-400 uppercase tracking-widest">Destacado</span> : null}
        {model.id === loadedId ? <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-volt/15 text-volt uppercase tracking-widest">En memoria</span> : null}
        {cls ? (
          <span data-testid="model-class" className={`font-mono text-[10px] px-2 py-0.5 rounded border uppercase tracking-widest ${CLASS_STYLE[cls.level]}`}>
            {cls.level}
            {cls.estimated && started ? " (est.)" : ""}
          </span>
        ) : null}
      </div>
      <h3 className="font-display font-semibold text-lg text-white mt-3">{model.label}</h3>
      <p className="font-mono text-[11px] text-slate-500 mt-1 break-all">{model.id}</p>
      {model.description ? <p className="mt-2 text-sm text-slate-400 leading-relaxed">{model.description}</p> : null}
      {model.capabilities?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {model.capabilities.map((c) => (
            <span key={c} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-ink-700/50 text-slate-400">{c}</span>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wider">
        <span className="px-2 py-0.5 rounded bg-ink-700 text-slate-300">VRAM ~{fmtMB(model.vramMB)}</span>
        {model.requiredFeatures.map((f) => (
          <span key={f} className="px-2 py-0.5 rounded bg-ink-700 text-slate-300">
            {f}
          </span>
        ))}
        {model.contextWindow ? <span className="px-2 py-0.5 rounded bg-ink-700 text-slate-300">ctx {model.contextWindow}</span> : null}
      </div>
      {cls && started ? (
        <details className="mt-3 text-[11px] text-slate-500 font-mono">
          <summary className="cursor-pointer hover:text-slate-300">¿Por qué {cls.level}?</summary>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {cls.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-5 flex items-center gap-2 font-mono text-xs text-slate-400">
        <span className={`status-dot ${dot}`} />
        <span data-testid="model-status-text">{label}</span>
      </div>

      {(m.status === "DOWNLOADING" || m.status === "LOADING" || (m.status === "DELETING" && m.progress != null)) && (
        <div className="mt-3">
          <div className="h-2 bg-ink-800 rounded overflow-hidden" role="progressbar" aria-valuenow={percent ?? 0} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-volt transition-[width]" style={{ width: (percent ?? 0) + "%" }} />
          </div>
          <p className="mt-1 font-mono text-[10px] text-slate-500 break-words" data-testid="model-progress-text">
            {m.text}
          </p>
        </div>
      )}

      {m.error ? (
        <p data-testid="model-error" className="mt-3 font-mono text-xs text-red2 bg-red2/10 border border-red2/30 rounded p-3 break-words whitespace-pre-wrap">
          {m.error}
        </p>
      ) : null}
      {lastDelete ? (
        <p data-testid="format-result" className={`mt-3 font-mono text-xs ${lastDelete.ok ? "text-volt" : "text-red2"}`}>
          {lastDelete.ok
            ? "Datos locales eliminados." + (lastDelete.freedBytes != null ? " Liberado ≈ " + fmtBytes(lastDelete.freedBytes) + " (estimación del navegador)." : "")
            : lastDelete.error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          data-testid="model-main-btn"
          className="flex-1 min-w-[120px] bg-volt text-ink-950 font-semibold text-sm px-4 py-2.5 rounded-md hover:bg-emerald-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={mainDisabled}
          onClick={() => {
            selectModel(model.id);
            if (hardBlock && !window.confirm("Con la VRAM que has declarado este modelo no cabría. ¿Intentarlo igualmente?")) return;
            download(model.id);
          }}
        >
          {mainLabel}
        </button>
        {m.status === "DOWNLOADING" || m.status === "LOADING" ? (
          <button data-testid="model-cancel-btn" className="border border-amber2/50 text-amber2 font-mono text-xs uppercase px-3 rounded-md hover:bg-amber2/10" onClick={cancelDownload}>
            Cancelar
          </button>
        ) : null}
        {inMemory ? (
          <>
            <a href="#lab" onClick={() => selectModel(model.id)} className="inline-flex items-center border border-volt/60 text-volt font-mono text-xs uppercase px-3 rounded-md hover:bg-volt hover:text-ink-950 transition">
              Laboratorio
            </a>
            <button data-testid="model-unload-btn" disabled={m.status === "GENERATING"} className="border border-ink-500 text-slate-300 font-mono text-xs uppercase px-3 py-2 rounded-md hover:bg-ink-800 disabled:opacity-40" onClick={unload} title="Descarga el modelo de la memoria; conserva los datos descargados">
              Liberar memoria
            </button>
          </>
        ) : null}
      </div>

      {started && (m.cached || m.status === "ERROR") && !working && !inMemory ? (
        confirming ? (
          <div className="mt-3 border border-red2/40 rounded-md p-3 bg-red2/5 font-mono text-xs" data-testid="format-confirm">
            <p className="text-slate-200">
              ¿Eliminar TODOS los datos locales de <span className="text-white">{model.id}</span>? Tendrás que volver a descargarlo.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                data-testid="format-confirm-btn"
                className="flex-1 bg-red2 text-ink-950 font-semibold px-3 py-2 rounded"
                onClick={async () => {
                  setConfirming(false);
                  await deleteModel(model.id);
                }}
              >
                SÍ, FORMATEAR
              </button>
              <button className="flex-1 border border-ink-500 text-slate-300 px-3 py-2 rounded" onClick={() => setConfirming(false)}>
                NO
              </button>
            </div>
          </div>
        ) : (
          <button
            data-testid="model-format-btn"
            disabled={busyElsewhere}
            className="mt-3 w-full border border-red2/50 text-red2 font-mono text-xs uppercase tracking-wider px-3 py-2 rounded-md hover:bg-red2/10 transition disabled:opacity-40"
            onClick={() => setConfirming(true)}
            title="Elimina del disco los datos descargados de este modelo"
          >
            Formatear modelo
          </button>
        )
      ) : null}
    </article>
  );
}
