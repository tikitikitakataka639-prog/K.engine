import { Reveal } from "./Reveal";
import { ModelCard } from "./ModelCard";
import { useEngine } from "../engine/EngineProvider";

export function ModelSelector() {
  const { ready, initError, catalog, selectedId, selectModel, startPhase } = useEngine();
  const extra = ready && !catalog.featured.some((m) => m.id === selectedId) ? catalog.models.find((m) => m.id === selectedId) : null;
  return (
    <section id="catalog" className="py-20 lg:py-28 border-b border-ink-700 bg-ink-900/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-3xl">
          <p className="font-mono text-volt text-xs uppercase tracking-[0.25em] mb-3">// Model Catalog</p>
          <h2 className="font-display font-bold text-3xl lg:text-4xl text-white">Catálogo de modelos</h2>
          <p className="mt-4 text-slate-400 leading-relaxed">
            Los modelos salen de <span className="font-mono">prebuiltAppConfig.model_list</span> de la versión instalada de WebLLM
            {ready && catalog.version ? " (" + catalog.version + ")" : ""}. Nada se descarga sin tu acción explícita. La etiqueta de compatibilidad es una
            estimación: el navegador no expone tu VRAM.
          </p>
          {startPhase !== "RUNNING" ? <p className="mt-3 font-mono text-xs text-amber2">Pulsa INICIAR MOTOR arriba para comprobar tu hardware y habilitar las descargas.</p> : null}
        </Reveal>
        {initError ? <p className="mt-6 font-mono text-xs text-red2 bg-red2/10 border border-red2/30 rounded p-3">{initError}</p> : null}
        {ready && catalog.missingFeatured.length ? (
          <p className="mt-6 font-mono text-xs text-amber2">Modelos destacados que no existen en esta versión de WebLLM (omitidos): {catalog.missingFeatured.join(", ")}</p>
        ) : null}
        <div id="modelCatalog" className="mt-12 grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {ready ? catalog.featured.map((m) => <ModelCard key={m.id} model={m} />) : <p className="font-mono text-xs text-slate-500">Cargando catálogo…</p>}
          {extra ? <ModelCard key={extra.id} model={extra} /> : null}
        </div>
        {ready ? (
          <div className="mt-8 bg-ink-900 border border-ink-600 rounded-lg p-5 max-w-2xl">
            <label htmlFor="anyModel" className="block font-mono text-[11px] uppercase tracking-widest text-slate-500 mb-2">
              Elegir manualmente otro modelo de WebLLM ({catalog.total} disponibles)
            </label>
            <select
              id="anyModel"
              data-testid="any-model-select"
              className="w-full bg-ink-950 border border-ink-600 rounded px-3 py-2 text-slate-200 font-mono text-xs"
              value={selectedId}
              onChange={(e) => selectModel(e.target.value)}
            >
              {catalog.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                  {m.vramMB ? " · ~" + Math.round(m.vramMB) + " MB" : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </section>
  );
}
