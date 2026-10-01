import { useEffect, useRef, useState } from "react";
import { useEngine } from "../engine/EngineProvider";

export function Chat() {
  const { messages, defaultModel, labStatus, labError, sendChat, chatReady } = useEngine();
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    const n = scrollRef.current;
    if (n) n.scrollTop = n.scrollHeight;
  }, [messages]);

  return (
    <div className="lg:col-span-8">
      <div className="bg-ink-900 border border-ink-600 rounded-lg overflow-hidden flex flex-col h-[560px]">
        <div className="px-5 py-3 border-b border-ink-700 bg-ink-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-volt">K.ENGINE MODEL LAB</p>
            <p className="font-mono text-[11px] text-slate-500 mt-0.5">
              MODEL: <span id="labModelName" className="text-slate-300">{defaultModel}</span>
            </p>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400 flex gap-3 flex-wrap">
            <span>
              DEVICE: <span className="text-slate-200">[GPU]</span>
            </span>
            <span>
              STATUS: <span id="labStatus" className="text-slate-200">{labStatus}</span>
            </span>
            <span className="text-volt">PERSONALITY: KERNEL</span>
            <span className="text-amber2">MODE: ISOLATED</span>
          </div>
        </div>
        <div id="chatScroll" ref={scrollRef} className="chat-scroll flex-1 overflow-y-auto p-5 space-y-4 font-mono text-[13px] leading-relaxed">
          <div className="text-slate-500 text-xs border border-ink-700 rounded-md p-4 bg-ink-950/60">
            Sesión de prueba aislada. Descarga y carga el modelo con <span className="text-volt">DESCARGAR MODELO</span>. Cuando el estado sea{" "}
            <span className="text-volt">READY</span>, escribe un mensaje y el modelo generará respuesta real con streaming local. Nada de esta sesión toca
            KERNEL.
          </div>
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  (m.role === "user"
                    ? "bg-volt/10 border border-volt/30 text-slate-100"
                    : "bg-ink-800 border border-ink-600 text-slate-200") +
                  " rounded-lg px-4 py-2.5 max-w-[85%] whitespace-pre-wrap break-words"
                }
              >
                <span className={"block text-[10px] uppercase tracking-widest mb-1 " + (m.role === "user" ? "text-volt" : "text-slate-500")}>
                  {m.role === "user" ? "USER" : "KERNEL"}
                </span>
                <span className="content">{m.content}</span>
              </div>
            </div>
          ))}
        </div>
        <form
          id="labForm"
          className="border-t border-ink-700 bg-ink-800 p-4 flex gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (sendChat(text)) setText("");
          }}
        >
          <input
            id="labInput"
            type="text"
            autoComplete="off"
            placeholder="Escribir mensaje…"
            className="flex-1 bg-ink-950 border border-ink-600 rounded-md px-4 py-2.5 font-mono text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-volt/60 disabled:opacity-40"
            disabled={!chatReady}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            className="bg-volt text-ink-950 font-semibold text-sm px-5 py-2.5 rounded-md hover:bg-emerald-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!chatReady}
          >
            Enviar
          </button>
        </form>
      </div>
      <p id="labError" className={`${labError ? "" : "hidden"} mt-3 font-mono text-xs text-red2 bg-red2/10 border border-red2/30 rounded p-3 break-words`}>
        {labError}
      </p>
    </div>
  );
}
