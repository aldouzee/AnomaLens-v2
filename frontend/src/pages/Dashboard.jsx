import { useCallback, useEffect, useRef, useState } from "react";
import { clearStats, getStats } from "../api/client.js";
import PredictionForm, { Badge } from "../components/PredictionForm.jsx";
import BatchUpload from "../components/BatchUpload.jsx";
import LivePanel from "../components/LivePanel.jsx";
import { modelLabel } from "../modelNames.js";

const POLL_MS = 2000;
const MAX_POINTS = 300; // buffer; the chart and feed show the latest 60 per model

export default function Dashboard({ info }) {
  const [stats, setStats] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const refresh = useCallback(() => getStats().then(setStats).catch(() => {}), []);

  // Scored records from every source (live / manual / batch), newest first. Feeds the score chart.
  const [points, setPoints] = useState([]);
  const counter = useRef(0);
  const addPoints = useCallback((records) => {
    const numbered = records.map((r) => ({ ...r, n: ++counter.current })).reverse();
    setPoints((prev) => [...numbered, ...prev].slice(0, MAX_POINTS));
  }, []);
  const onScored = useCallback((records) => { addPoints(records); refresh(); }, [addPoints, refresh]);

  const [clearError, setClearError] = useState(null);
  const clear = () => {
    setClearError(null);
    setPoints([]); // score chart and live feed are drawn from these, so they empty right away
    clearStats().then(setStats).catch((e) => setClearError(e.message));
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
      <h1>ANOMA<span className="g">LENS</span></h1>

      <div className="cards">
        <div className="card"><small className="muted">Total scored</small><div className="kv">{stats?.total ?? 0}</div></div>
        <div className="card"><small className="muted">Anomalies</small><div className="kv bad">{stats?.anomalies ?? 0}</div></div>
        <div className="card"><small className="muted">Anomaly rate</small><div className="kv">{((stats?.anomaly_rate ?? 0) * 100).toFixed(1)}<span>%</span></div></div>
        <div className="card"><small className="muted">Models loaded</small><div className="kv">{info.models.length}</div></div>
      </div>

      <h2 className="sub">Live monitor <span className="muted">· automatic</span></h2>
      <LivePanel info={info} points={points} onRecord={addPoints} onRunningChange={setStreaming} />

      <h2 className="sub">Score records <span className="muted">· manual</span></h2>
      <div className="cols">
        <PredictionForm features={info.features} models={info.models} onScored={onScored} />
        <BatchUpload models={info.models} onScored={onScored} />
      </div>

      <div className="card">
        <h3>Recent predictions</h3>
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
      <div>
        <button className="btn danger" disabled={!stats?.total && !points.length} onClick={clear}>Clear history</button>
        {clearError && <span className="err" style={{ marginLeft: 12 }}>{clearError}</span>}
      </div>
    </>
  );
}
