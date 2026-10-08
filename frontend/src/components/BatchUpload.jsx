import { useState } from "react";
import { predictCsv } from "../api/client.js";
import ModelSelector from "./ModelSelector.jsx";

export default function BatchUpload({ models = [], onScored }) {
  const [model, setModel] = useState(models[0]?.id ?? "random_forest");
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true); setError(null);
    try {
      const out = await predictCsv(model, file);
      onScored?.(out.rows.map((r) => ({ model: out.model, features: r.features, prediction: r.prediction, score: r.score, source: "batch" })));
    }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="card">
      <h3>Batch Upload</h3>
      <ModelSelector models={models} value={model} onChange={setModel} />
      <label className="field"><span>CSV file</span>
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files[0] ?? null)} />
      </label>
      <button className="btn" disabled={!file || busy} onClick={run}>{busy ? "Scoring…" : "Score File"}</button>
      {error && <p className="err">{error}</p>}
    </div>
  );
}
