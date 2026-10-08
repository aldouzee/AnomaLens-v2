import { useCallback, useEffect, useRef, useState } from "react";
import { clearStats, getStats } from "../api/client.js";
import PredictionForm, { Badge } from "../components/PredictionForm.jsx";
import BatchUpload from "../components/BatchUpload.jsx";
import LivePanel from "../components/LivePanel.jsx";
import StatsCard from "../components/StatsCard.jsx";
import { modelLabel } from "../modelNames.js";

const POLL_MS = 2000;
const MAX_POINTS = 300; // buffer; the chart shows the latest 60 per model

export default function Dashboard({ info }) {
  const [stats, setStats] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const refresh = useCallback(() => getStats().then(setStats).catch(() => {}), []);

  // Scored records from every source (Live / Single / Batch), newest first. Feeds the score chart.
  const [points, setPoints] = useState([]);
  const counter = useRef(0);
  const addPoints = useCallback((records) => {
    const numbered = records.map((r) => ({ ...r, n: ++counter.current })).reverse();
    setPoints((prev) => [...numbered, ...prev].slice(0, MAX_POINTS));
  }, []);
  const onScored = useCallback((records) => { addPoints(records); refresh(); }, [addPoints, refresh]);

  // Model whose scores the Packet Score chart plots (null = first model). A batch upload points the
  // chart at its own model so the new rows show up, unless a live stream is running on the current one.
  const [chartModel, setChartModel] = useState(null);
  const onBatchScored = useCallback((records) => {
    onScored(records);
    if (!streaming && records[0]) setChartModel(records[0].model);
  }, [onScored, streaming]);

  const [clearError, setClearError] = useState(null);
  const clear = () => {
    setClearError(null);
    setPoints([]); // score chart is drawn from these, so they empty right away
    clearStats().then(setStats).catch((e) => setClearError(e.message));
  };

  const download = () => {
    const header = ["source", "model", ...info.features, "prediction", "score"];
    const lines = stats.recent.map((r) => [r.source, r.model, ...info.features.map((f) => r.features[f]), r.prediction, r.score].join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "recent_predictions.csv" });
    a.click(); URL.revokeObjectURL(url);
  };

  useEffect(() => { refresh(); }, [refresh]);
  // the live stream scores on the server, so keep the summary in sync while it runs
  useEffect(() => {
    if (!streaming) return;
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [streaming, refresh]);

  if (!info) return <p className="muted">Loading…</p>;

  return (
    <>
      <h2>Dashboard</h2>
      <StatsCard stats={stats} modelCount={info.models.length} />

      <h2 className="sub">Live Monitor</h2>
      <LivePanel info={info} points={points} model={chartModel} onModelChange={setChartModel} onRecord={addPoints} onRunningChange={setStreaming} />

      <h2 className="sub">Manual Scoring</h2>
      <div className="cols">
        <PredictionForm features={info.features} models={info.models} onScored={onScored} />
        <BatchUpload models={info.models} onScored={onBatchScored} />
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Recent Network Predictions</h3>
          <div className="card-actions">
            <button className="btn sm" disabled={!stats?.recent?.length} onClick={download}>Download CSV</button>
            <button className="btn sm danger" disabled={!stats?.total && !points.length} onClick={clear}>Clear History</button>
          </div>
        </div>
        {clearError && <p className="err">{clearError}</p>}
        {stats?.recent?.length ? (
          <div className="scroll">
            <table className="tbl">
              <thead><tr><th>Source</th><th>Model</th>{info.features.map((f) => <th key={f}>{f}</th>)}<th>Verdict</th><th>Score</th></tr></thead>
              <tbody>
                {stats.recent.map((r, i) => (
                  <tr key={i}>
                    <td><span className={`tag ${r.source}`}>{r.source}</span></td>
                    <td>{modelLabel(r.model)}</td>
                    {info.features.map((f) => <td key={f}>{Number(r.features[f]).toFixed(2)}</td>)}
                    <td><Badge verdict={r.prediction} /></td><td>{r.score.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">Nothing scored yet.</p>}
      </div>
    </>
  );
}
