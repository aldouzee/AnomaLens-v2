import { useEffect, useState } from "react";
import { openStream } from "../api/client.js";
import { modelLabel } from "../modelNames.js";
import ModelSelector from "./ModelSelector.jsx";
import AnomalyChart from "./AnomalyChart.jsx";
import LiveFeed from "./LiveFeed.jsx";

const SHOWN = 60;

/**
 * Automatic scoring: streams simulated records through the chosen model.
 * `points` holds every scored record (live, manual and batch, newest first); the chart shows
 * those of the selected model, the feed only the live ones.
 */
export default function LivePanel({ info, points, onRecord, onRunningChange }) {
  const [model, setModel] = useState(null);
  const [rate, setRate] = useState(2);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("stopped");

  const selected = model ?? info.models[0]?.id;

  useEffect(() => {
    if (!running || !selected) return;
    const close = openStream({
      model: selected, rate, onStatus: setStatus,
      onMessage: (m) => onRecord([{ ...m, source: "live" }]),
    });
    return close;
  }, [running, selected, rate, onRecord]);

  useEffect(() => { onRunningChange?.(running); }, [running, onRunningChange]);

  const forModel = points.filter((p) => p.model === selected).slice(0, SHOWN);
  const live = forModel.filter((p) => p.source === "live");
  const anomalies = forModel.filter((p) => p.prediction === "anomaly").length;

  return (
    <>
      <div className="card toolbar">
        <ModelSelector models={info.models} value={selected} onChange={setModel} />
        <label className="field"><span>Rate: {rate}/s</span>
          <input type="range" min="1" max="10" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
        </label>
        <button className="btn" onClick={() => setRunning((r) => !r)}>{running ? "Stop" : "Start stream"}</button>
        <span className={`tag ${status}`}>{status}</span>
        <span className="muted">{anomalies} anomalies in last {forModel.length}</span>
      </div>
      <div className="card">
        <h3>Anomaly score · {modelLabel(selected)}</h3>
        <p className="muted small">Newest on the right. Filled dots are live records; rings are records you scored manually or by batch.</p>
        <AnomalyChart data={[...forModel].reverse()} />
      </div>
      <div className="card"><h3>Live feed</h3><LiveFeed items={live} features={info.features} /></div>
    </>
  );
}
