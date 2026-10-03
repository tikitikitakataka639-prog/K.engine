// Presentación de estados de modelo (los estados los decide ModelManager).
export const STATUS_LABELS = {
  CHECKING: ["bg-slate-600", "COMPROBANDO CACHÉ"],
  NOT_DOWNLOADED: ["bg-slate-600", "NO DESCARGADO"],
  DOWNLOADED: ["bg-sky-400", "DESCARGADO · EN DISCO"],
  DOWNLOADING: ["bg-amber2 blinking", "DESCARGANDO"],
  LOADING: ["bg-amber2 blinking", "CARGANDO EN GPU"],
  VERIFYING: ["bg-amber2 blinking", "VERIFICANDO"],
  READY: ["bg-volt", "READY"],
  GENERATING: ["bg-volt blinking", "GENERANDO"],
  UNLOADING: ["bg-amber2 blinking", "LIBERANDO MEMORIA"],
  DELETING: ["bg-amber2 blinking", "ELIMINANDO DATOS"],
  CANCELLING: ["bg-amber2 blinking", "CANCELANDO"],
  ERROR: ["bg-red2", "ERROR"],
  INCOMPATIBLE: ["bg-red2", "NO COMPATIBLE"],
};

export const CLASS_STYLE = {
  RECOMENDADO: "bg-volt/15 text-volt border-volt/40",
  POSIBLE: "bg-sky-400/10 text-sky-300 border-sky-400/30",
  PESADO: "bg-amber2/10 text-amber2 border-amber2/40",
  "NO COMPATIBLE": "bg-red2/10 text-red2 border-red2/40",
};

export const pct = (v) => (v == null ? null : Math.round(v * 100));
