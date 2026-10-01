export function Hero() {
  return (
    <section id="top" className="grid-bg scan-line pt-32 pb-20 lg:pt-40 lg:pb-28 border-b border-ink-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7">
          <p className="font-mono text-volt text-xs uppercase tracking-[0.25em] mb-4">// Motor de inferencia local · Fase 1</p>
          <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl leading-[1.08] text-white">
            El motor de IA independiente de <span className="text-volt">KERNEL</span>.
          </h1>
          <p className="mt-6 text-lg text-slate-400 max-w-2xl leading-relaxed">
            K.ENGINE ejecuta inferencia <strong className="text-slate-200">100% local en tu navegador</strong> mediante WebGPU y WebLLM.
            Sin OpenAI, sin Gemini, sin Claude, sin créditos, sin respuestas simuladas. Descarga el modelo MLC una vez, guárdalo en caché y
            genera streaming real desde tu GPU.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a href="#lab" className="inline-flex items-center gap-2 bg-volt text-ink-950 font-semibold px-6 py-3 rounded-md hover:bg-emerald-300 transition">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              DESCARGAR MODELO
            </a>
            <a
              href="#engine"
              className="inline-flex items-center gap-2 border border-ink-500 text-slate-300 font-medium px-6 py-3 rounded-md hover:border-volt hover:text-volt transition font-mono text-sm uppercase tracking-wider"
            >
              Ver arquitectura
            </a>
          </div>
          <div className="mt-10 grid grid-cols-3 max-w-md divide-x divide-ink-600 font-mono text-center">
            <div className="px-2">
              <div className="text-volt text-xl font-semibold">100%</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider mt-1">Local</div>
            </div>
            <div className="px-2">
              <div className="text-volt text-xl font-semibold">0</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider mt-1">APIs externas</div>
            </div>
            <div className="px-2">
              <div className="text-volt text-xl font-semibold">WebGPU</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider mt-1">Inferencia</div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="bg-ink-900 border border-ink-600 rounded-lg shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ink-700 bg-ink-800">
              <span className="w-2.5 h-2.5 rounded-full bg-red2/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber2/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-volt/70" />
              <span className="ml-3 font-mono text-[11px] text-slate-500 uppercase tracking-widest">k.engine — engine.status</span>
            </div>
            <pre className="font-mono text-[12.5px] leading-relaxed p-5 text-slate-300 overflow-x-auto">
              <span className="text-slate-600">$</span> kengine status
              {"\n\n"}
              <span className="text-volt">ENGINE</span>          ONLINE
              {"\n"}
              <span className="text-volt">BACKEND</span>          WebLLM (activo)
              {"\n"}
              <span className="text-volt">DEVICE</span>            [GPU] via WebGPU
              {"\n"}
              <span className="text-volt">MODEL</span>             Llama-3.2-1B-Instruct
              {"\n"}                  q4f16_1-MLC
              {"\n"}
              <span className="text-volt">STATUS</span>            NOT_INSTALLED → READY
              {"\n"}
              <span className="text-volt">PERSONALITY</span>       KERNEL
              {"\n"}
              <span className="text-volt">MODE</span>              ISOLATED
              {"\n"}
              <span className="text-volt">CRÉDITOS</span>          <span className="text-red2">0 · no aplica</span>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
