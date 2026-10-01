import { useEngine } from "../engine/EngineProvider";

export function Settings() {
  const { control, patchControl, saveConfig, testConfig } = useEngine();
  const set = (k) => (e) => patchControl({ [k]: e.target.value });
  return (
    <div className="bg-ink-900 border border-ink-600 rounded-lg p-6">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-500 mb-4">Backend de inferencia</h3>
      <label className="block text-slate-500 mb-1" htmlFor="cfgBackend">
        BACKEND
      </label>
      <select
        id="cfgBackend"
        className="w-full bg-ink-950 border border-ink-600 rounded px-3 py-2 text-slate-200 mb-3"
        value={control.cfgBackend}
        onChange={set("cfgBackend")}
        disabled={control.cfgDisabled}
      >
        <option value="auto">AUTO (OpenAI-compatible si está configurado; si no, WebLLM)</option>
        <option value="webllm">BROWSER / WEBLLM</option>
        <option value="openai-compatible">OPENAI-COMPATIBLE</option>
      </select>
      <label className="block text-slate-500 mb-1" htmlFor="cfgBaseUrl">
        BASE URL (KENGINE_BASE_URL)
      </label>
      <input
        id="cfgBaseUrl"
        type="text"
        autoComplete="off"
        placeholder="http://127.0.0.1:11434/v1"
        className="w-full bg-ink-950 border border-ink-600 rounded px-3 py-2 text-slate-200 mb-3"
        value={control.cfgBaseUrl}
        onChange={set("cfgBaseUrl")}
        disabled={control.cfgDisabled}
      />
      <label className="block text-slate-500 mb-1" htmlFor="cfgApiKey">
        API KEY (KENGINE_API_KEY) <span id="cfgKeyState" className="text-slate-400">{control.cfgKeyState}</span>
      </label>
      <input
        id="cfgApiKey"
        type="password"
        autoComplete="off"
        placeholder="vacío = conservar la actual"
        className="w-full bg-ink-950 border border-ink-600 rounded px-3 py-2 text-slate-200 mb-3"
        value={control.cfgApiKey}
        onChange={set("cfgApiKey")}
        disabled={control.cfgDisabled}
      />
      <label className="block text-slate-500 mb-1" htmlFor="cfgModel">
        MODEL (KENGINE_MODEL)
      </label>
      <input
        id="cfgModel"
        type="text"
        autoComplete="off"
        placeholder="qwen3:4b"
        className="w-full bg-ink-950 border border-ink-600 rounded px-3 py-2 text-slate-200 mb-3"
        value={control.cfgModel}
        onChange={set("cfgModel")}
        disabled={control.cfgDisabled}
      />
      <label className="block text-slate-500 mb-1" htmlFor="cfgToken">
        TOKEN DE LA API (KENGINE_AUTH_TOKEN, solo si el servidor lo exige)
      </label>
      <input
        id="cfgToken"
        type="password"
        autoComplete="off"
        className="w-full bg-ink-950 border border-ink-600 rounded px-3 py-2 text-slate-200 mb-4"
        value={control.cfgToken}
        onChange={set("cfgToken")}
      />
      <div className="flex gap-2">
        <button
          id="cfgSave"
          className="flex-1 bg-volt text-ink-950 font-semibold px-4 py-2.5 rounded-md hover:bg-emerald-300 transition disabled:opacity-40"
          disabled={control.cfgDisabled}
          onClick={saveConfig}
        >
          GUARDAR
        </button>
        <button
          id="cfgTest"
          className="flex-1 border border-ink-500 text-slate-300 uppercase tracking-wider px-4 py-2.5 rounded-md hover:bg-ink-800 transition disabled:opacity-40"
          disabled={control.cfgDisabled}
          onClick={testConfig}
        >
          PROBAR
        </button>
      </div>
      <pre id="cfgMsg" className="mt-3 whitespace-pre-wrap break-words text-slate-400">
        {control.cfgMsg}
      </pre>
      <p className="mt-3 text-slate-500">
        Los cambios se guardan en la memoria del servidor (no en disco) y se pierden al reiniciarlo. Para dejarlos fijos, usa variables de entorno.
      </p>
    </div>
  );
}
