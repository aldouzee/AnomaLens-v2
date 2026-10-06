import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import MetricsTable from "../components/MetricsTable.jsx";
import PredictionForm from "../components/PredictionForm.jsx";
import { personaName } from "../modelNames.js";

const SERIES = [["precision", "#00ff6a"], ["recall", "#b6f21a"], ["f1", "#4aa8ff"], ["roc_auc", "#c08cff"]];

export default function ModelComparison({ info }) {
  if (!info) return <p className="muted">Loading…</p>;
  const data = info.models.map((m) => ({ name: personaName(m.id, m.name), ...m.metrics }));
  const d = info.dataset;
  return (
    <>
      {d?.test_anomalies != null && (
        <h1>Model Arena</h1>
      )}
      
      <div className="card"><h3>Metrics</h3><MetricsTable models={info.models} /></div>

      <div className="card">
        <h3>Model Performance Comparison</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid stroke="#2a3a2f" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#8aa192" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 1]} stroke="#8aa192" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#101612", border: "1px solid #2a3a2f" }} />
            <Legend />
            {SERIES.map(([k, c]) => <Bar key={k} dataKey={k} fill={c} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
