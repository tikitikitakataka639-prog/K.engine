import { Reveal } from "./Reveal";

export function ApiSection() {
  return (
    <section id="api" className="py-20 lg:py-28 border-b border-ink-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-start">
        <Reveal>
          <p className="font-mono text-volt text-xs uppercase tracking-[0.25em] mb-3">// API de K.ENGINE</p>
          <h2 className="font-display font-bold text-3xl lg:text-4xl text-white">Lista para KERNEL</h2>
          <p className="mt-4 text-slate-400 leading-relaxed">
            KERNEL WEB no necesita saber cómo funciona WebLLM internamente. La superficie de K.ENGINE expone una API estable para que la interfaz existente se
            conecte cuando tú decidas:
          </p>
          <ul className="mt-6 font-mono text-sm space-y-2.5">
            <li className="flex items-center gap-3">
              <span className="text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded text-[11px]">GET</span>
              <span className="text-slate-300">/health</span>
              <span className="text-slate-500 text-xs">estado y versión</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded text-[11px]">GET</span>
              <span className="text-slate-300">/models</span>
              <span className="text-slate-500 text-xs">modelos y backend (estado real)</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-volt bg-volt/10 px-2 py-0.5 rounded text-[11px]">POST</span>
              <span className="text-slate-300">/chat</span>
              <span className="text-slate-500 text-xs">respuesta; SSE con stream:true</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded text-[11px]">GET</span>
              <span className="text-slate-300">/config</span>
              <span className="text-slate-500 text-xs">backend (API key enmascarada)</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-volt bg-volt/10 px-2 py-0.5 rounded text-[11px]">POST</span>
              <span className="text-slate-300">/config</span>
              <span className="text-slate-500 text-xs">cambiar backend en caliente</span>
            </li>
          </ul>
          <p className="mt-6 font-mono text-xs text-slate-500 leading-relaxed">
            Seguridad: sin CMD, sin PowerShell, sin Bash, sin ejecución arbitraria, sin acceso a archivos. El futuro Windows Connector será un componente
            independiente y explícito.
          </p>
        </Reveal>
        <Reveal>
          <div className="bg-ink-900 border border-ink-600 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ink-700 bg-ink-800">
              <span className="w-2.5 h-2.5 rounded-full bg-red2/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber2/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-volt/70" />
              <span className="ml-3 font-mono text-[11px] text-slate-500 uppercase tracking-widest">kengine.config — personality</span>
            </div>
            <pre className="font-mono text-[12px] leading-relaxed p-5 text-slate-300 overflow-x-auto">{`persona.js = {
  name: "KERNEL",
  idioma: "español de España",
  tono: ["serio", "directo", "analítico",
         "técnico cuando corresponde"],
  evita: ["emojis (salvo petición)",
          "saludos genéricos",
          "lenguaje empresarial",
          "inventar datos"],
  separada_del_motor: true
}`}</pre>
          </div>
          <p className="mt-4 font-mono text-[11px] text-slate-500">
            La personalidad vive en la capa de configuración, no en el componente visual del chat. Cambiar de modelo no la duplica.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
