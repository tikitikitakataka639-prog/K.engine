import { Reveal } from "./Reveal";
import { useEngine } from "../engine/EngineProvider";

export function Hardware() {
  const { hardware } = useEngine();
  return (
    <section id="hardware" className="py-20 lg:py-28 border-b border-ink-700 bg-ink-900/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12">
        <Reveal>
          <p className="font-mono text-volt text-xs uppercase tracking-[0.25em] mb-3">// Hardware Adaptation Engine</p>
          <h2 className="font-display font-bold text-3xl lg:text-4xl text-white">Motor adaptativo</h2>
          <p className="mt-4 text-slate-400 leading-relaxed">
            K.ENGINE detecta WebGPU, el adaptador gráfico y los límites del dispositivo, y clasifica tu equipo como LIGHT, MEDIUM o ADVANCED. Solo recomienda:
            nunca descarga modelos pesados automáticamente. Tú mantienes el control.
          </p>
          <div className="mt-8 grid sm:grid-cols-3 gap-4 font-mono text-xs">
            <div className="bg-ink-900 border border-ink-600 rounded-lg p-4">
              <p className="text-volt uppercase tracking-widest">LIGHT</p>
              <p className="text-slate-400 mt-2">Modelos ≤1B · q4f16 · GPU integrada</p>
            </div>
            <div className="bg-ink-900 border border-ink-600 rounded-lg p-4">
              <p className="text-volt uppercase tracking-widest">MEDIUM</p>
              <p className="text-slate-400 mt-2">Modelos 1.5B–3B · contexto ampliado</p>
            </div>
            <div className="bg-ink-900 border border-ink-600 rounded-lg p-4">
              <p className="text-volt uppercase tracking-widest">ADVANCED</p>
              <p className="text-slate-400 mt-2">Vision y modelos grandes · GPU dedicada</p>
            </div>
          </div>
        </Reveal>
        <Reveal>
          <div className="bg-ink-900 border border-ink-600 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-ink-700 bg-ink-800 font-mono text-[11px] uppercase tracking-widest text-slate-500">Detección en vivo</div>
            <dl className="p-5 font-mono text-xs space-y-3">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">WEBGPU</dt>
                <dd id="hwWebgpu" className={hardware.webgpu ? "text-volt font-semibold" : "text-red2 font-semibold"}>
                  {hardware.webgpu ? "SÍ" : hardware.webgpuLabel === "COMPROBANDO…" ? "—" : "NO"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">GPU / ADAPTADOR</dt>
                <dd id="hwGpu" className="text-slate-200 text-right">
                  {hardware.gpu}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">LÍMITES (MAX BUFFER)</dt>
                <dd id="hwBuf" className="text-slate-200">
                  {hardware.buf}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">HILOS CPU</dt>
                <dd id="hwCores" className="text-slate-200">
                  {hardware.cores}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">CLASIFICACIÓN</dt>
                <dd id="hwClass" className="text-volt font-semibold">
                  {hardware.hwClass}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">MODELO RECOMENDADO</dt>
                <dd id="hwRec" className="text-slate-200 text-right">
                  {hardware.rec}
                </dd>
              </div>
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
