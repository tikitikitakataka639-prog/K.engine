import { useState } from "react";
import { Logo } from "./Logo";

export function Nav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-ink-700 bg-ink-950/85 backdrop-blur">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display font-bold text-lg tracking-tight">K.engine</span>
        </a>
        <div className="hidden lg:flex items-center gap-7 font-mono text-[13px] uppercase tracking-wider text-slate-400">
          <a href="#engine" className="hover:text-volt transition">
            Engine
          </a>
          <a href="#catalog" className="hover:text-volt transition">
            Catálogo
          </a>
          <a href="#lab" className="hover:text-volt transition">
            Model Lab
          </a>
          <a href="#hardware" className="hover:text-volt transition">
            Hardware
          </a>
          <a href="#api" className="hover:text-volt transition">
            API
          </a>
        </div>
        <div className="flex items-center gap-3">
          <a href="/webllm-test.html" className="hidden sm:inline-flex hover:text-volt transition font-mono text-[12px] uppercase tracking-wider">
            WebLLM Test ↗
          </a>
          <a href="#lab" className="hidden sm:inline-flex items-center gap-2 bg-volt text-ink-950 font-semibold text-sm px-4 py-2 rounded-md hover:bg-emerald-300 transition">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            Iniciar motor
          </a>
          <button
            id="navToggle"
            className="lg:hidden p-2 text-slate-300 hover:text-volt"
            aria-label="Abrir menú"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </nav>
      <div id="navMobile" className={`${open ? "" : "hidden"} lg:hidden border-t border-ink-700 bg-ink-950 px-4 py-4 font-mono text-sm uppercase tracking-wider space-y-3`}>
        <a href="#engine" className="block hover:text-volt" onClick={close}>
          Engine
        </a>
        <a href="#catalog" className="block hover:text-volt" onClick={close}>
          Catálogo
        </a>
        <a href="#lab" className="block hover:text-volt" onClick={close}>
          Model Lab
        </a>
        <a href="#hardware" className="block hover:text-volt" onClick={close}>
          Hardware
        </a>
        <a href="#control" className="block hover:text-volt" onClick={close}>
          Control
        </a>
        <a href="#api" className="block hover:text-volt" onClick={close}>
          API
        </a>
        <a href="#lab" className="block text-volt font-semibold" onClick={close}>
          Iniciar motor →
        </a>
      </div>
    </header>
  );
}
