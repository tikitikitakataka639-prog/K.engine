import { Reveal } from "./Reveal";

const ITEMS = [
  {
    q: "¿Necesito subir algún archivo del modelo?",
    a: (
      <>
        No. Al pulsar DESCARGAR, WebLLM descarga los archivos MLC oficiales desde Hugging Face (
        <span className="font-mono">mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC</span>) y los guarda en la caché del navegador. En visitas posteriores el modelo aparece como DESCARGADO y solo hay que cargarlo, sin volver a descargar.
      </>
    ),
  },
  {
    q: "¿Las respuestas son reales o simuladas?",
    a: "Reales. Streaming token a token desde la GPU vía WebGPU, sin fake streaming, sin progreso falso, sin respuestas predefinidas. Las métricas del laboratorio provienen del propio runtime; si una no es fiable, se muestra N/A.",
  },
  {
    q: "¿Qué pasa con el chat principal de KERNEL?",
    a: "Nada. El Model Lab es un entorno aislado por modelo. Al cerrarlo, su contexto de prueba queda separado: no toca historial, memoria, configuración ni conversaciones de KERNEL.",
  },
  {
    q: "¿Cuándo se conecta con la interfaz de KERNEL?",
    a: "En la siguiente fase. La API de K.ENGINE ya está diseñada para que la interfaz existente (project-kernel) se conecte sin conocer los detalles de WebLLM. ToolRouter y n8n quedan preparados pero desactivados.",
  },
];

export function Faq() {
  return (
    <section className="py-20 lg:py-28 border-b border-ink-700 bg-ink-900/40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal as="h2" className="font-display font-bold text-3xl lg:text-4xl text-white">
          Preguntas directas
        </Reveal>
        <div className="mt-10 divide-y divide-ink-700 border-y border-ink-700">
          {ITEMS.map((item) => (
            <Reveal key={item.q} as="details" className="group py-5">
              <summary className="flex items-center justify-between cursor-pointer font-medium text-slate-200 group-open:text-volt list-none">
                {item.q}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 transition group-open:rotate-45">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">{item.a}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
