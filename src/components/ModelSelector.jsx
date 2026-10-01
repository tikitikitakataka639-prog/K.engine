import { Reveal } from "./Reveal";
import { useEngine } from "../engine/EngineProvider";
import { STATUS_LABELS } from "../webllm/catalog";

function ModelCard({ model, status, progress, progressText, isDefault }) {
  const [dotClass, label] = STATUS_LABELS[status] || STATUS_LABELS.NOT_INSTALLED;
  const showBtn = status === "READY" || status === "GENERATING";
  const showProgress = status === "DOWNLOADING" || status === "LOADING";
  return (
    <Reveal
      className={`model-card bg-ink-900 border ${isDefault ? "border-volt/40" : "border-ink-600"} rounded-lg p-6`}
      data-model-id={model.id}
    >
      {isDefault ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-volt/15 text-volt uppercase tracking-widest">Default · Active</span>
            <h3 className="font-display font-semibold text-lg text-white mt-3">{model.label}</h3>
            <p className="font-mono text-[11px] text-slate-500 mt-1 break-all">{model.hf}</p>
          </div>
        </div>
      ) : (
        <>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-ink-700 text-slate-400 uppercase tracking-widest">
            {model.tier === "VISION" ? "Prepared · Vision" : "Prepared"}
          </span>
          <h3 className="font-display font-semibold text-lg text-white mt-3">{model.label}</h3>
          <p className="font-mono text-[11px] text-slate-500 mt-1 break-all">{model.hf}</p>
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wider">
        <span className="px-2 py-0.5 rounded bg-ink-700 text-slate-300">{model.tier}</span>
        {model.size ? <span className="px-2 py-0.5 rounded bg-ink-700 text-slate-300">{model.size}</span> : null}
        {model.quant ? <span className="px-2 py-0.5 rounded bg-ink-700 text-slate-300">{model.quant}</span> : null}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <span className="model-status flex items-center gap-2 font-mono text-xs text-slate-400">
          <span className={`status-dot ${dotClass}`} />
          <span className="model-status-text">{label}</span>
        </span>
        <a
          href="#lab"
          className={`model-test-btn ${showBtn ? "inline-flex" : "hidden"} items-center gap-1.5 border border-volt/60 text-volt font-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded hover:bg-volt hover:text-ink-950 transition`}
          title="Probar modelo"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
          </svg>
          Probar
        </a>
      </div>
      <div className={`model-progress ${showProgress ? "" : "hidden"} mt-4`}>
        <div className="h-1.5 bg-ink-700 rounded overflow-hidden">
          <div className="model-progress-bar h-full bg-volt transition-all" style={{ width: Math.round((progress || 0) * 100) + "%" }} />
        </div>
        <p className="model-progress-text font-mono text-[11px] text-slate-500 mt-1.5" title={progressText || ""}>
          {(status === "LOADING" ? "Cargando shader… " : "") + Math.round((progress || 0) * 100) + "%"}
        </p>
      </div>
    </Reveal>
  );
}

export function ModelSelector() {
  const { catalog, defaultModel, status, progress } = useEngine();
  return (
    <section id="catalog" className="py-20 lg:py-28 border-b border-ink-700 bg-ink-900/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <p className="font-mono text-volt text-xs uppercase tracking-[0.25em] mb-3">// Model Catalog</p>
            <h2 className="font-display font-bold text-3xl lg:text-4xl text-white">Catálogo de modelos</h2>
            <p className="mt-4 text-slate-400 leading-relaxed">
              Un modelo activo por defecto; el resto preparado para fases futuras. Ningún modelo secundario se descarga sin tu acción explícita.
            </p>
          </div>
          <div className="font-mono text-xs text-slate-500 uppercase tracking-wider bg-ink-900 border border-ink-600 rounded-md px-4 py-3">
            Estados: <span className="text-slate-300">NOT_INSTALLED · DOWNLOADING · DOWNLOADED · LOADING · READY · GENERATING · UNLOADING · ERROR</span>
          </div>
        </Reveal>
        <div id="modelCatalog" className="mt-12 grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {catalog.map((m) => (
            <ModelCard
              key={m.id}
              model={m}
              isDefault={m.id === defaultModel}
              status={m.id === defaultModel ? status : "NOT_INSTALLED"}
              progress={m.id === defaultModel ? progress.value : 0}
              progressText={m.id === defaultModel ? progress.text : ""}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
