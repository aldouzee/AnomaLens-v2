// Baked in at build time. https:// becomes wss:// for the stream (browsers block ws:// on HTTPS pages).
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch { /* keep statusText */ }
    throw new Error(detail);
  }
  return res.json();
}

const json = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const getModels = () => request("/models");
export const getExplain = () => request("/models/explain");
export const getStats =() => request("/stats");
export const clearStats = () => request("/stats", { method: "DELETE" });
export const predict = (model, features) => request("/predict", json({ model, features }));
export const predictCsv = (model, file) => {
  const form = new FormData();
  form.append("file", file);
  return request(`/predict/batch/csv?model=${encodeURIComponent(model)}`, { method: "POST", body: form });
};

/** Opens the live stream; reconnects with backoff. Returns a close() function. */
export function openStream({ model, rate, onMessage, onStatus }) {
  let ws, timer, retry = 0, closed = false;
  const wsBase = API_URL.replace(/^http/, "ws");
  const connect = () => {
    onStatus?.("connecting");
    ws = new WebSocket(`${wsBase}/ws/stream?model=${encodeURIComponent(model)}&rate=${rate}`);
    ws.onopen = () => { retry = 0; onStatus?.("live"); };
    ws.onmessage = (e) => onMessage(JSON.parse(e.data));
    ws.onclose = () => {
      if (closed) return;
      onStatus?.("reconnecting");
      timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 10000));
    };
  };
  connect();
  return () => { closed = true; clearTimeout(timer); ws?.close(); onStatus?.("stopped"); };
}
