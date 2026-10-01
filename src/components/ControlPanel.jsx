import { EngineStatus } from "./EngineStatus";
import { Settings } from "./Settings";
import { CacheManager } from "./CacheManager";

export function ControlPanel() {
  return (
    <section id="control" className="py-20 lg:py-28 border-b border-ink-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-volt text-xs uppercase tracking-[0.25em] mb-3">// Panel de control</p>
        <h2 className="font-display font-bold text-3xl lg:text-4xl text-white">Estado, backend y caché</h2>
        <p className="mt-4 text-slate-400 leading-relaxed max-w-3xl">
          Todo lo que se muestra aquí se lee del estado real: del navegador (WebGPU, Cache API) o de <span className="font-mono">server.js</span>. Si no puede
          conocerse, se indica.
        </p>
        <div className="mt-10 grid lg:grid-cols-3 gap-6 font-mono text-xs">
          <EngineStatus />
          <Settings />
          <CacheManager />
        </div>
      </div>
    </section>
  );
}
