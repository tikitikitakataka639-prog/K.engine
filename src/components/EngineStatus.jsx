import { useEngine } from "../engine/EngineProvider";

export function EngineStatus() {
  const { statusLines: s, control, loadedId, startPhase } = useEngine();
  const row = (k, v, cls = "text-slate-200", id) => (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd id={id} className={cls + " text-right break-all"}>
        {v}
      </dd>
    </div>
  );
  return (
    <div className="bg-ink-900 border border-ink-600 rounded-lg p-6">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-500 mb-4">K.ENGINE · Intelligence Engine</h3>
      <dl className="space-y-2.5">
        {row("ENGINE STATUS", s.engine, startPhase === "RUNNING" && loadedId ? "text-volt" : "text-amber2", "ksEngine")}
        {row("BACKEND", "WEBLLM")}
        {row("MODEL", s.model, "text-slate-200", "ksModel")}
        {row("WEBGPU", s.webgpu, s.webgpuOk ? "text-volt" : s.webgpuOk === false ? "text-red2" : "text-slate-400", "ksWebgpu")}
        {row("API (server.js)", s.api, s.apiOk ? "text-volt" : "text-amber2", "ksApi")}
        {row("BRIDGE WEBLLM", control.ksBridge, control.ksBridge === "CONECTADO" ? "text-volt" : "text-slate-400", "ksBridge")}
      </dl>
    </div>
  );
}
