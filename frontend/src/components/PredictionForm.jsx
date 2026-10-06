import { useState } from "react";
import { predict } from "../api/client.js";
import ModelSelector from "./ModelSelector.jsx";
import { modelLabel } from "../modelNames.js";

const DEFAULTS = { throughput: 2, congestion: 0.3, packet_loss: 0, latency: 7, jitter: 0.6 };

export function Badge({ verdict }) {
  return <span className={`badge ${verdict}`}>{verdict === "anomaly" ? "Anomaly" : "Normal"}</span>;
}

export function ResultRows({ results }) {
  return (
    <table className="tbl">
      <thead><tr><th>Model</th><th>Verdict</th><th>Score</th><th>Latency</th></tr></thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.model}>
            <td>{modelLabel(r.model)}</td><td><Badge verdict={r.prediction} /></td>
            <td>{r.score.toFixed(3)}</td><td>{r.latency_ms} ms</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PredictionForm({ features = [], models = [], allowAll = true, onScored }) {
  const [model, setModel] = useState(models[0]?.id ?? "random_forest");
  const [values, setValues] = useState(() => Object.fromEntries(features.map((f) => [f, DEFAULTS[f] ?? 0])));
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const body = Object.fromEntries(features.map((f) => [f, Number(values[f])]));
      const res = await predict(model, body);
      const list = res.results ?? [res];
      setResults(list);
      onScored?.(list.map((r) => ({ ...r, features: body, source: "manual" })));
    } catch (err) {
      setError(err.message); setResults(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h3>Score a record</h3>
      <ModelSelector models={models} value={model} onChange={setModel} allowAll={allowAll} />
      <div className="inputs">
        {features.map((f) => (
          <label className="field" key={f}>
            <span>{f.replace("_", " ")}</span>
            <input type="number" step="any" required value={values[f] ?? ""}
                   onChange={(e) => setValues({ ...values, [f]: e.target.value })} />
          </label>
        ))}
      </div>
      <button className="btn" disabled={busy || !features.length}>{busy ? "Scoring…" : "Predict"}</button>
      {error && <p className="err">{error}</p>}
      {results && <ResultRows results={results} />}
    </form>
  );
}
