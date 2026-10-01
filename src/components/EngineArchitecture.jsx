import { Reveal } from "./Reveal";

const LAYERS = [
  {
    n: "Capa 01",
    title: "Inference Engine",
    body: "Orquesta backends y sesiones. Hoy: WebLLMBackend activo. GGUFBackend queda como punto de extensión futuro, sin simular compatibilidad.",
  },
  {
    n: "Capa 02",
    title: "Web Worker",
    body: "La descarga, la carga y la generación corren en un worker dedicado. La interfaz nunca se bloquea durante la inferencia.",
  },
  {
    n: "Capa 03",
    title: "WebGPU + MLC",
    body: "Compilación MLCache del modelo Llama-3.2-1B-Instruct-q4f16_1 ejecutada directamente sobre la GPU del dispositivo.",
  },
  {
    n: "Capa 04",
    title: "Model Manager",
    body: "Catálogo, descarga desde Hugging Face, caché del navegador, estados reales, progreso, cancelación, impedir cargas simultáneas y descarga de memoria.",
  },
  {
    n: "Capa 05",
    title: "Context Manager",
    body: "Historial y ventana de contexto por sesión, con poda. El contexto del Model Lab es independiente: no toca KERNEL.",
  },
  {
    n: "Capa 06",
    title: "ToolRouter (preparado)",
    body: (
      <>
        web_search, browser, vision, system y windows_connector quedan declarados pero <strong className="text-amber2">desactivados</strong>. Sin ejecución de
        comandos, sin acceso al PC.
      </>
    ),
  },
];

export function EngineArchitecture() {
  return (
    <section id="engine" className="py-20 lg:py-28 border-b border-ink-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-3xl">
          <p className="font-mono text-volt text-xs uppercase tracking-[0.25em] mb-3">// Arquitectura</p>
          <h2 className="font-display font-bold text-3xl lg:text-4xl text-white">Un pipeline completo, sin intermediarios.</h2>
          <p className="mt-4 text-slate-400 leading-relaxed">
            KERNEL WEB habla con K.ENGINE. K.ENGINE habla con el motor de inferencia. Nada viaja a ningún servidor de terceros. La generación ocurre dentro de
            tu navegador.
          </p>
        </Reveal>
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {LAYERS.map((l) => (
            <Reveal key={l.n} className="bg-ink-900 border border-ink-600 rounded-lg p-6 hover:border-volt/50 transition">
              <div className="font-mono text-[11px] text-volt uppercase tracking-widest mb-3">{l.n}</div>
              <h3 className="font-display font-semibold text-lg text-white">{l.title}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{l.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
