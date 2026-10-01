import { useEngine } from "../engine/EngineProvider";

export function EngineStatus() {
  const { control, recommend, applyRecommendation } = useEngine();
  return (
    <div className="bg-ink-900 border border-ink-600 rounded-lg p-6">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-500 mb-4">K.ENGINE · Intelligence Engine</h3>
      <dl className="space-y-2.5">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">ENGINE STATUS</dt>
          <dd id="ksEngine" className={control.ksEngineClass}>
            {control.ksEngine}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">BACKEND</dt>
          <dd id="ksBackend" className="text-slate-200">
            {control.ksBackend}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">MODEL</dt>
          <dd id="ksModel" className="text-slate-200">
            {control.ksModel}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">WEBGPU</dt>
          <dd id="ksWebgpu" className={control.ksWebgpuClass}>
            {control.ksWebgpu}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">CACHE</dt>
          <dd id="ksCache" className={control.ksCacheClass}>
            {control.ksCache}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">API</dt>
          <dd id="ksApi" className={control.ksApiClass}>
            {control.ksApi}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">BRIDGE WEBLLM</dt>
          <dd id="ksBridge" className={control.ksBridgeClass}>
            {control.ksBridge}
          </dd>
        </div>
      </dl>
      <h3 className="mt-8 text-[11px] uppercase tracking-widest text-slate-500 mb-3">Selección de modelo</h3>
      <button
        id="recBtn"
        className="w-full border border-volt/50 text-volt uppercase tracking-wider px-4 py-2.5 rounded-md hover:bg-volt/10 transition"
        onClick={() => recommend(true)}
      >
        Evaluar dispositivo
      </button>
      <pre id="recOut" className="mt-3 whitespace-pre-wrap break-words text-slate-300">
        {control.recOut}
      </pre>
      <button
        id="recApply"
        className={`${control.recApplyHidden ? "hidden" : ""} mt-2 w-full border border-ink-500 text-slate-300 uppercase tracking-wider px-4 py-2 rounded-md hover:bg-ink-800 transition`}
        onClick={applyRecommendation}
      >
        Usar el recomendado
      </button>
    </div>
  );
}
