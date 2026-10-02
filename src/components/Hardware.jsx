import { Reveal } from "./Reveal";
import { useEngine } from "../engine/EngineProvider";
import { CLASS_STYLE } from "../engine/status";
import { fmtMB } from "../engine/hardware";

const mb = (n) => (n ? Math.round(n / 1024 / 1024) + " MB" : "N/A");

function Row({ k, v, cls = "text-slate-200", id }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd id={id} className={cls + " text-right break-words"}>
        {v}
      </dd>
    </div>
  );
}

export function Hardware() {
  const { hardware: hw, manualVram, setManualVram, catalog, classes, startPhase } = useEngine();
  const started = startPhase === "RUNNING";
  const yes = (b) => (b ? "SÍ" : "NO");
  return (
    <section id="hardware" className="py-20 lg:py-28 border-b border-ink-700 bg-ink-900/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12">
        <Reveal>
          <p className="font-mono text-volt text-xs uppercase tracking-[0.25em] mb-3">// Hardware Adaptation Engine</p>
          <h2 className="font-display font-bold text-3xl lg:text-4xl text-white">Compatibilidad con tu equipo</h2>
          <p className="mt-4 text-slate-400 leading-relaxed">
            K.ENGINE comprueba <span className="font-mono">navigator.gpu</span>, <span className="font-mono">requestAdapter()</span>, las características (
            <span className="font-mono">shader-f16</span>) y los límites del adaptador, e intenta crear un dispositivo real. El navegador <strong>no expone la VRAM</strong>:
            si la conoces, indícala y la clasificación será más fiable. Siempre puedes elegir cualquier modelo manualmente.
          </p>
          <div className="mt-6 bg-ink-900 border border-ink-600 rounded-lg p-5 max-w-md">
            <label htmlFor="vramInput" className="block font-mono text-[11px] uppercase tracking-widest text-slate-500 mb-2">
              VRAM disponible (GB) — opcional
            </label>
            <input
              id="vramInput"
              data-testid="vram-input"
              type="number"
              min="0.5"
              max="256"
              step="0.5"
              placeholder="p. ej. 6"
              className="w-full bg-ink-950 border border-ink-600 rounded px-3 py-2 text-slate-200 font-mono text-sm"
              value={manualVram ?? ""}
              onChange={(e) => setManualVram(e.target.value)}
            />
            <p className="mt-2 text-[11px] text-slate-500">Dato declarado por ti; no se verifica. Se guarda solo en este navegador.</p>
          </div>
          <div className="mt-6 space-y-2" data-testid="hw-classes">
            {started
              ? catalog.featured.map((m) => {
                  const c = classes[m.id];
                  return c ? (
                    <div key={m.id} className="flex items-center justify-between gap-3 font-mono text-xs bg-ink-900 border border-ink-600 rounded px-3 py-2">
                      <span className="text-slate-300 break-all">
                        {m.label} <span className="text-slate-500">(~{fmtMB(m.vramMB)})</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded border uppercase tracking-widest text-[10px] shrink-0 ${CLASS_STYLE[c.level]}`}>{c.level}</span>
                    </div>
                  ) : null;
                })
              : <p className="font-mono text-xs text-slate-500">Pulsa INICIAR MOTOR para clasificar los modelos.</p>}
          </div>
        </Reveal>
        <Reveal>
          <div className="bg-ink-900 border border-ink-600 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-ink-700 bg-ink-800 font-mono text-[11px] uppercase tracking-widest text-slate-500">Detección en vivo</div>
            <dl className="p-5 font-mono text-xs space-y-3">
              {!hw.checked ? (
                <p className="text-slate-500">Sin comprobar. Pulsa INICIAR MOTOR.</p>
              ) : (
                <>
                  <Row id="hwSecure" k="CONTEXTO SEGURO" v={yes(hw.secureContext)} cls={hw.secureContext ? "text-volt" : "text-red2"} />
                  <Row id="hwNavGpu" k="navigator.gpu" v={yes(hw.hasNavigatorGpu)} cls={hw.hasNavigatorGpu ? "text-volt" : "text-red2"} />
                  <Row id="hwAdapter" k="requestAdapter()" v={hw.adapter ? "ADAPTADOR OBTENIDO" : "SIN ADAPTADOR"} cls={hw.adapter ? "text-volt" : "text-red2"} />
                  <Row id="hwDevice" k="requestDevice()" v={hw.deviceOk == null ? "—" : hw.deviceOk ? "OK" : "FALLA"} cls={hw.deviceOk ? "text-volt" : "text-red2"} />
                  <Row id="hwF16" k="shader-f16" v={yes(hw.shaderF16)} cls={hw.shaderF16 ? "text-volt" : "text-amber2"} />
                  <Row id="hwGpu" k="GPU / ADAPTADOR" v={hw.info.description || hw.info.vendor || hw.info.architecture || (hw.adapter ? "detalles no expuestos" : "N/A")} />
                  <Row k="VENDOR / ARQUITECTURA" v={[hw.info.vendor, hw.info.architecture].filter(Boolean).join(" / ") || "N/A"} />
                  <Row k="ADAPTADOR SOFTWARE" v={hw.fallbackAdapter == null ? "N/A" : yes(hw.fallbackAdapter)} cls={hw.fallbackAdapter ? "text-amber2" : "text-slate-200"} />
                  <Row id="hwBuf" k="maxBufferSize" v={mb(hw.limits.maxBufferSize)} />
                  <Row k="maxStorageBufferBindingSize" v={mb(hw.limits.maxStorageBufferBindingSize)} />
                  <Row k="maxComputeWorkgroupStorageSize" v={hw.limits.maxComputeWorkgroupStorageSize ? hw.limits.maxComputeWorkgroupStorageSize + " B" : "N/A"} />
                  <Row k="maxComputeInvocationsPerWorkgroup" v={hw.limits.maxComputeInvocationsPerWorkgroup ?? "N/A"} />
                  <Row id="hwCores" k="HILOS CPU" v={hw.cores ?? "N/A"} />
                  <Row k="RAM (navigator.deviceMemory)" v={hw.deviceMemoryGB ? "≥ " + hw.deviceMemoryGB + " GB (tope del navegador)" : "no expuesta"} />
                  <Row k="VRAM" v="NO EXPUESTA POR EL NAVEGADOR" cls="text-slate-400" />
                </>
              )}
            </dl>
            {hw.checked && hw.problems.length ? (
              <div data-testid="hw-problems" className="px-5 pb-5 font-mono text-xs text-amber2 space-y-1">
                {hw.problems.map((p, i) => (
                  <p key={i}>• {p}</p>
                ))}
              </div>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
