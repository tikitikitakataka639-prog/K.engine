export const tokenGet = () => {
  try {
    return sessionStorage.getItem("kengine_token") || "";
  } catch {
    return "";
  }
};

export const tokenSet = (value) => {
  try {
    sessionStorage.setItem("kengine_token", value);
  } catch {
    /* sessionStorage no disponible */
  }
};

export async function api(path, opts = {}) {
  const h = { ...(opts.headers || {}) };
  if (opts.body) h["Content-Type"] = "application/json";
  const t = tokenGet();
  if (t) h.Authorization = "Bearer " + t;
  const r = await fetch(path, { ...opts, headers: h });
  const text = await r.text();
  let j = null;
  try {
    j = JSON.parse(text);
  } catch {
    /* no JSON */
  }
  if (!r.ok) throw Object.assign(new Error((j && j.error) || "HTTP " + r.status), { status: r.status });
  return j;
}

export async function probeApi() {
  if (!/^https?:$/.test(location.protocol)) return { ok: false, version: null };
  try {
    const r = await fetch("/health");
    const j = await r.json();
    return { ok: Boolean(j && j.engine === "K.ENGINE"), version: j.version || null };
  } catch {
    return { ok: false, version: null };
  }
}
