// ModelManager: ÚNICA capa que decide el estado de los modelos.
//   - es dueña del Worker (donde corre WebLLM) y del estado por modelo;
//   - comprueba/borra datos con las funciones de WebLLM (hasModelInCache, deleteModelAllInfoInCache);
//   - los componentes solo leen el estado (getSnapshot) y llaman a estas acciones.
// Estados por modelo: CHECKING · CANCELLED · NOT_DOWNLOADED · DOWNLOADED (en disco, no en memoria) · DOWNLOADING · LOADING ·
//   VERIFYING · READY · GENERATING · UNLOADING · DELETING · ERROR
import { loadCatalog, loadWebLLM, DEFAULT_MODEL_ID } from "./models";
import { classifyModel } from "./hardware";
import { saveModelMeta, deleteModelMeta } from "./storage";

export const ACTIVE = ["DOWNLOADING", "LOADING", "VERIFYING", "UNLOADING", "DELETING"]; // operaciones en curso
export const IN_MEMORY = ["READY", "GENERATING"];

const blankModel = () => ({ status: "CHECKING", cached: null, progress: null, text: "", error: null, lastAction: null });

function storageUsage() {
  return navigator.storage && navigator.storage.estimate ? navigator.storage.estimate().then((e) => e.usage ?? null).catch(() => null) : Promise.resolve(null);
}

class ModelManager {
  constructor() {
    this.listeners = new Set();
    this.messageListeners = new Set();
    this.worker = null;
    this.hw = null;
    this.manual = {};
    this.op = null; // { id, kind, promise, resolve }
    this.snapshot = {
      ready: false,
      initError: null,
      catalog: { models: [], featured: [], missingFeatured: [], version: null, total: 0 },
      models: {},
      selectedId: DEFAULT_MODEL_ID,
      loadedId: null,
      opKind: null,
      opId: null,
      cacheApiOk: typeof caches !== "undefined",
    };
  }

  /* ---------- suscripción (useSyncExternalStore) ---------- */
  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snapshot;
  onMessage(fn) {
    this.messageListeners.add(fn);
    return () => this.messageListeners.delete(fn);
  }
  #set(patch) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }
  #patchModel(id, patch) {
    const prev = this.snapshot.models[id] || blankModel();
    this.#set({ models: { ...this.snapshot.models, [id]: { ...prev, ...patch } } });
  }

  /* ---------- inicialización ---------- */
  async init() {
    if (this.snapshot.ready) return;
    try {
      const catalog = await loadCatalog();
      const selectedId = catalog.featured.find((m) => m.id === this.snapshot.selectedId) ? this.snapshot.selectedId : (catalog.featured[0] || catalog.models[0]).id;
      this.#set({ catalog, selectedId, ready: true, initError: null });
      await Promise.all(catalog.featured.map((m) => this.refreshCache(m.id)));
    } catch (e) {
      this.#set({ initError: "No se pudo cargar la configuración de WebLLM: " + ((e && e.message) || e) });
    }
  }

  setHardware(hw, manual = {}) {
    this.hw = hw;
    this.manual = manual;
    this.#set({}); // fuerza re-render: la clasificación depende del hardware
  }
  setManual(manual) {
    this.manual = manual;
    this.#set({});
  }

  select(id) {
    if (this.snapshot.catalog.models.some((m) => m.id === id)) {
      this.#set({ selectedId: id });
      if (!this.snapshot.models[id]) this.refreshCache(id);
    }
  }

  modelInfo(id) {
    return this.snapshot.catalog.models.find((m) => m.id === id) || null;
  }
  classify(id) {
    const m = this.modelInfo(id);
    return m ? classifyModel(m, this.hw, this.manual) : null;
  }

  /* ---------- comprobación de datos locales ---------- */
  async refreshCache(id) {
    const cur = this.snapshot.models[id];
    if (cur && (ACTIVE.includes(cur.status) || IN_MEMORY.includes(cur.status))) return;
    this.#patchModel(id, { status: "CHECKING" });
    try {
      const webllm = await loadWebLLM();
      const cached = await webllm.hasModelInCache(id, webllm.prebuiltAppConfig);
      const now = this.snapshot.models[id];
      if (now && (ACTIVE.includes(now.status) || IN_MEMORY.includes(now.status))) return;
      this.#patchModel(id, { cached, status: cached ? "DOWNLOADED" : "NOT_DOWNLOADED", error: null });
    } catch (e) {
      this.#patchModel(id, { cached: null, status: "NOT_DOWNLOADED", error: "No se pudo comprobar la Cache API: " + ((e && e.message) || e) });
    }
  }

  /* ---------- worker ---------- */
  #worker() {
    if (this.worker) return this.worker;
    const w = new Worker(new URL("../webllm/kengine-worker.js", import.meta.url), { type: "module" });
    w.addEventListener("message", (ev) => this.#onWorker(ev.data));
    w.addEventListener("error", (ev) => {
      const msg = "Error del worker: " + (ev.message || "no se pudo iniciar (¿fallo al importar WebLLM?)");
      this.#failOp(msg);
    });
    this.worker = w;
    return w;
  }
  #killWorker() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
  }
  post(msg) {
    this.#worker().postMessage(msg);
  }

  #onWorker(d) {
    const id = this.op?.id || this.snapshot.loadedId;
    switch (d.type) {
      case "status":
        if (this.op && ["DOWNLOADING", "UNLOADING", "VERIFYING"].includes(d.value)) {
          this.#patchModel(this.op.id, { status: d.value, progress: d.value === "DOWNLOADING" ? 0 : null });
        }
        break;
      case "progress":
        if (this.op && this.op.kind === "load") {
          this.#patchModel(this.op.id, { status: d.phase, progress: Math.max(0, Math.min(1, d.progress)), text: d.text });
        }
        break;
      case "verified":
      case "ready":
        if (this.op && this.op.kind === "load") {
          const mid = this.op.id;
          this.#set({ loadedId: mid });
          this.#patchModel(mid, { status: "READY", cached: true, progress: 1, text: "", error: null });
          saveModelMeta(mid, { downloaded: true, lastReadyMs: d.ms ?? null });
          this.#finishOp();
        }
        break;
      case "genstart":
        if (id) this.#patchModel(id, { status: "GENERATING" });
        break;
      case "gendone":
        if (id) this.#patchModel(id, { status: "READY" });
        break;
      case "unloaded":
        if (this.op && this.op.kind === "unload") {
          const mid = this.op.id;
          this.#set({ loadedId: null });
          this.#patchModel(mid, { status: "DOWNLOADED", progress: null, text: "" });
          this.#finishOp();
          this.refreshCache(mid);
        }
        break;
      case "error":
        if (d.scope === "load") this.#failOp(d.message);
        else if (d.scope === "unload") this.#failOp(d.message, "READY");
        else if (d.scope === "generate" && id) this.#patchModel(id, { status: "READY" });
        break;
      default:
        break;
    }
    this.messageListeners.forEach((fn) => fn(d));
  }

  /* ---------- operaciones con candado (evita cargas duplicadas) ---------- */
  #startOp(id, kind) {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    this.op = { id, kind, promise, resolve };
    this.#set({ opKind: kind, opId: id });
  }
  #finishOp(result = { ok: true }) {
    const op = this.op;
    this.op = null;
    this.#set({ opKind: null, opId: null });
    if (op) op.resolve(result);
  }
  #failOp(message, fallbackStatus) {
    const op = this.op;
    if (!op) {
      const lid = this.snapshot.loadedId;
      if (lid) this.#patchModel(lid, { error: message });
      return;
    }
    // Nunca dejamos READY por error: si la carga falló, el modelo no está en memoria.
    const keepLoaded = fallbackStatus === "READY";
    if (!keepLoaded && op.kind !== "delete") {
      this.#killWorker();
      if (this.snapshot.loadedId === op.id) this.#set({ loadedId: null });
    }
    this.#patchModel(op.id, { status: keepLoaded ? "READY" : "ERROR", error: message, progress: null });
    this.#finishOp({ ok: false, error: message });
    if (!keepLoaded) this.refreshCacheAfterError(op.id);
  }
  async refreshCacheKeepCancelled(id) {
    try {
      const webllm = await loadWebLLM();
      this.#patchModel(id, { cached: await webllm.hasModelInCache(id, webllm.prebuiltAppConfig) });
    } catch {
      /* mantiene CANCELLED */
    }
  }
  async refreshCacheAfterError(id) {
    try {
      const webllm = await loadWebLLM();
      const cached = await webllm.hasModelInCache(id, webllm.prebuiltAppConfig);
      this.#patchModel(id, { cached });
    } catch {
      /* mantiene el error original */
    }
  }

  /** Descarga (si hace falta) + carga en GPU + verificación. WebLLM no separa descarga y carga. */
  download(id = this.snapshot.selectedId) {
    const info = this.modelInfo(id);
    if (!info) return Promise.resolve({ ok: false, error: "Modelo desconocido en prebuiltAppConfig.model_list: " + id });
    if (this.op) {
      if (this.op.id === id && this.op.kind === "load") return this.op.promise; // sin cargas duplicadas
      return Promise.resolve({ ok: false, error: "Hay otra operación en curso (" + this.op.kind + " " + this.op.id + ")." });
    }
    const loaded = this.snapshot.loadedId;
    if (loaded === id) return Promise.resolve({ ok: true });
    const cls = this.classify(id);
    if (cls && cls.blocking) {
      const error = "No se intenta cargar " + id + ": " + cls.reasons[0];
      this.#patchModel(id, { status: "ERROR", error });
      return Promise.resolve({ ok: false, error });
    }
    if (this.snapshot.models[id]?.status === "GENERATING" || (loaded && this.snapshot.models[loaded]?.status === "GENERATING")) {
      return Promise.resolve({ ok: false, error: "Generación en curso." });
    }
    if (loaded) this.#patchModel(loaded, { status: "DOWNLOADED" }); // el worker descarga el anterior al cargar otro
    this.#set({ loadedId: null });
    this.#startOp(id, "load");
    this.#patchModel(id, { status: "DOWNLOADING", progress: 0, text: "", error: null });
    this.post({ type: "load", model: id });
    return this.op.promise;
  }

  /** Aborta una descarga/carga en curso terminando el worker. Los ficheros ya guardados en caché se conservan. */
  cancel() {
    if (!this.op || this.op.kind !== "load") return;
    const id = this.op.id;
    this.#killWorker();
    this.#finishOp({ ok: false, error: "cancelado" });
    this.#patchModel(id, { status: "CANCELLED", progress: null, text: "", error: "Descarga cancelada. Lo ya descargado se conserva en caché." });
    this.refreshCacheKeepCancelled(id);
  }

  /** LIBERAR MEMORIA: descarga el modelo de la GPU/RAM pero conserva los datos en disco. */
  unload() {
    const id = this.snapshot.loadedId;
    if (!id || this.op) return Promise.resolve({ ok: false, error: id ? "Operación en curso." : "No hay modelo cargado." });
    if (this.snapshot.models[id]?.status === "GENERATING") return Promise.resolve({ ok: false, error: "Hay una generación en curso." });
    this.#startOp(id, "unload");
    this.#patchModel(id, { status: "UNLOADING" });
    this.post({ type: "unload" });
    return this.op.promise;
  }

  cancelGenerate() {
    this.post({ type: "cancel" });
  }

  generate(job) {
    this.post({ type: "generate", ...job });
  }

  /**
   * FORMATEAR MODELO: elimina los datos locales de UN modelo con deleteModelAllInfoInCache de WebLLM.
   * La API no da progreso: se informa de estado, y de bytes liberados (estimación de storage.estimate()).
   */
  async deleteModel(id) {
    if (!this.modelInfo(id)) return { ok: false, error: "Modelo desconocido." };
    if (this.op) return { ok: false, error: "Hay otra operación en curso." };
    const st = this.snapshot.models[id]?.status;
    if (IN_MEMORY.includes(st) || this.snapshot.loadedId === id) return { ok: false, error: "Libera el modelo de memoria antes de formatearlo." };
    this.#startOp(id, "delete");
    this.#patchModel(id, { status: "DELETING", error: null, progress: null, text: "Eliminando datos locales…" });
    const before = await storageUsage();
    try {
      const webllm = await loadWebLLM();
      const record = webllm.prebuiltAppConfig.model_list.find((r) => r.model_id === id);
      // Misma normalización que cleanModelUrl() de WebLLM.
      let prefix = String(record.model);
      if (!prefix.endsWith("/")) prefix += "/";
      if (!prefix.includes("/resolve/")) prefix += "resolve/main/";
      // Progreso REAL: nº de entradas del modelo que quedan en la Cache API (webllm/model).
      const remaining = async () => {
        try {
          return (await (await caches.open("webllm/model")).keys()).filter((r) => r.url.startsWith(prefix)).length;
        } catch {
          return null;
        }
      };
      const total = await remaining();
      await webllm.deleteModelAllInfoInCache(id, webllm.prebuiltAppConfig);
      // WebLLM 0.2.79 lanza deleteNDArrayCache() SIN await dentro de deleteModelInCache: la promesa devuelta
      // puede resolverse antes de que los shards desaparezcan. Se espera (máx. 60 s) a que el borrado termine de verdad.
      const jsonUrl = new URL("ndarray-cache.json", prefix).href;
      const shardsLeft = async () => {
        try {
          return (await (await caches.open("webllm/model")).keys()).filter((r) => r.url.startsWith(prefix) && r.url !== jsonUrl).length;
        } catch {
          return null;
        }
      };
      for (let i = 0; i < 120; i++) {
        const left = await shardsLeft();
        if (total && left != null) this.#patchModel(id, { progress: Math.max(0, 1 - left / total), text: "Eliminando entradas: " + (total - left) + "/" + total });
        if (!left) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      // WebLLM borra los shards pero deja el índice ndarray-cache.json de ESTE modelo: se elimina para no dejar restos.
      try {
        await (await caches.open("webllm/model")).delete(jsonUrl);
      } catch {
        /* se detectará abajo con hasModelInCache */
      }
      const still = await webllm.hasModelInCache(id, webllm.prebuiltAppConfig);
      const after = await storageUsage();
      await deleteModelMeta(id);
      const freed = before != null && after != null ? Math.max(0, before - after) : null;
      if (still) {
        this.#patchModel(id, { status: "DOWNLOADED", cached: true, text: "", error: "El borrado no fue completo: aún quedan datos en caché." });
        this.#finishOp({ ok: false });
        return { ok: false, error: "El borrado no fue completo." };
      }
      this.#patchModel(id, { status: "NOT_DOWNLOADED", cached: false, text: "", error: null, lastAction: { type: "deleted", freedBytes: freed, at: Date.now() } });
      this.#finishOp();
      return { ok: true, freedBytes: freed };
    } catch (e) {
      const error = "Error al eliminar datos del modelo: " + ((e && e.message) || e);
      this.#patchModel(id, { status: "ERROR", error, text: "" });
      this.#finishOp({ ok: false, error });
      this.refreshCacheAfterError(id);
      return { ok: false, error };
    }
  }

  /** Reintento tras ERROR. */
  retry(id = this.snapshot.selectedId) {
    return this.download(id);
  }

  dispose() {
    this.#killWorker();
  }
}

export const modelManager = new ModelManager();
