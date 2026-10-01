import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="py-14 bg-ink-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-10">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="font-display font-bold text-lg text-white">K.engine</span>
          </div>
          <p className="mt-4 text-sm text-slate-500 leading-relaxed max-w-xs">
            El motor de IA local e independiente de KERNEL. Inferencia real en el navegador con WebGPU y WebLLM.
          </p>
        </div>
        <div className="font-mono text-xs uppercase tracking-wider">
          <p className="text-slate-400 mb-4">Motor</p>
          <ul className="space-y-2.5 text-slate-500">
            <li>
              <a href="#engine" className="hover:text-volt transition">
                Engine
              </a>
            </li>
            <li>
              <a href="#catalog" className="hover:text-volt transition">
                Model Catalog
              </a>
            </li>
            <li>
              <a href="#lab" className="hover:text-volt transition">
                Model Lab
              </a>
            </li>
            <li>
              <a href="#hardware" className="hover:text-volt transition">
                Hardware
              </a>
            </li>
          </ul>
        </div>
        <div className="font-mono text-xs uppercase tracking-wider">
          <p className="text-slate-400 mb-4">Recursos</p>
          <ul className="space-y-2.5 text-slate-500">
            <li>
              <a href="https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC" target="_blank" rel="noopener noreferrer" className="hover:text-volt transition">
                Modelo en Hugging Face ↗
              </a>
            </li>
            <li>
              <a href="https://llm.mlc.ai/docs/" target="_blank" rel="noopener noreferrer" className="hover:text-volt transition">
                Documentación WebLLM ↗
              </a>
            </li>
            <li>
              <a href="https://www.w3.org/TR/webgpu/" target="_blank" rel="noopener noreferrer" className="hover:text-volt transition">
                Especificación WebGPU ↗
              </a>
            </li>
            <li>
              <a href="#api" className="hover:text-volt transition">
                API de integración
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-6 border-t border-ink-700 flex flex-col sm:flex-row justify-between gap-3 font-mono text-[11px] text-slate-600 uppercase tracking-wider">
        <p>© 2025 K.ENGINE · Fase 1: motor de inferencia local</p>
        <p>Sin APIs externas · Sin créditos · Sin simulaciones</p>
      </div>
    </footer>
  );
}
