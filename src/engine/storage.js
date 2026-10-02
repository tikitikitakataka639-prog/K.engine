// Persistencia local (IndexedDB): ajustes, metadatos de modelos e historial del laboratorio.
// Nada sale del navegador. Si IndexedDB no está disponible, las funciones degradan sin lanzar.
const DB_NAME = "kengine";
const STORES = ["settings", "models", "chats"];

let dbPromise = null;
function open() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  dbPromise ||= new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function run(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const tx = db.transaction(store, mode);
          const r = fn(tx.objectStore(store));
          tx.oncomplete = () => resolve(r && "result" in r ? r.result : undefined);
          tx.onerror = tx.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export const kvGet = (store, key) => run(store, "readonly", (s) => s.get(key));
export const kvSet = (store, key, value) => run(store, "readwrite", (s) => s.put(value, key));
export const kvDelete = (store, key) => run(store, "readwrite", (s) => s.delete(key));

export const getSetting = async (key, fallback = null) => (await kvGet("settings", key)) ?? fallback;
export const setSetting = (key, value) => kvSet("settings", key, value);

export const saveModelMeta = (id, meta) => kvSet("models", id, { ...meta, updatedAt: Date.now() });
export const getModelMeta = (id) => kvGet("models", id);
export const deleteModelMeta = (id) => kvDelete("models", id);

export const loadChat = async (modelId) => (await kvGet("chats", modelId)) || [];
export const saveChat = (modelId, messages) => kvSet("chats", modelId, messages.slice(-60));
export const clearChat = (modelId) => kvDelete("chats", modelId);
