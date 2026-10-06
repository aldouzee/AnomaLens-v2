import { useState } from "react";
import { predictCsv } from "../api/client.js";
import ModelSelector from "./ModelSelector.jsx";
import { Badge } from "./PredictionForm.jsx";

function toCsv(res) {
  const feats = Object.keys(res.rows[0].features);
  const lines = res.rows.map((r) => [...feats.map((f) => r.features[f]), r.prediction, r.score].join(","));
  return [[...feats, "prediction", "score"].join(","), ...lines].join("\n");
}

export default function BatchUpload({ models = [], onScored }) {
  const [model, setModel] = useState(models[0]?.id ?? "random_forest");
  const [file, setFile] = useState(null);
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true); setError(null);
    try {
      const out = await predictCsv(model, file);
      setRes(out);
      onScored?.(out.rows.map((r) => ({ model: out.model, features: r.features, prediction: r.prediction, score: r.score, source: "batch" })));
    }
    catch (e) { setError(e.message); setRes(null); }
    finally { setBusy(false); }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(res)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "predictions.csv" });
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <h3>Batch upload</h3>
      <p className="muted small">CSV with columns for each feature. Extra columns are ignored.</p>
      <ModelSelector models={models} value={model} onChange={setModel} />
      <label className="field"><span>CSV file</span>
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files[0] ?? null)} />
      </label>
      <button className="btn" disabled={!file || busy} onClick={run}>{busy ? "Scoring…" : "Score file"}</button>
      {error && <p className="err">{error}</p>}
      {res && (
        <>
          <p>{res.count} rows · <b>{res.anomalies}</b> anomalies · {res.latency_ms} ms
            <button className="btn sm" style={{ marginLeft: 12 }} onClick={download}>Download CSV</button></p>
          <div className="scroll">
            <table className="tbl">
              <thead><tr>{Object.keys(res.rows[0].features).map((f) => <th key={f}>{f}</th>)}<th>Verdict</th><th>Score</th></tr></thead>
              <tbody>
                {res.rows.slice(0, 200).map((r, i) => (
                  <tr key={i}>
                    {Object.values(r.features).map((v, j) => <td key={j}>{Number(v).toFixed(2)}</td>)}
                    <td><Badge verdict={r.prediction} /></td><td>{r.score.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {res.rows.length > 200 && <p className="muted small">Showing first 200 rows; download for all.</p>}
        </>
      )}
    </div>
  );
}
