import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getExplain } from "../api/client.js";
import ModelSelector from "./ModelSelector.jsx";

const COLORS = ["#75DA9F", "#C1FF72", "#B8D7E0", "#BCA1D5", "#E8B86B"];
const pretty = (f) => f.replace("_", " ");

/** Which inputs each model relies on, measured by permutation importance on the held-out test rows. */
export default function FeatureImportance({ models = [] }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [model, setModel] = useState(null);

  useEffect(() => {
    getExplain().then(setData).catch((e) => setError(e.message));
  }, []);

  const selected = model ?? models[0]?.id;
  const entry = data?.models.find((m) => m.id === selected);
  const rows = entry
    ? data.features
        .map((f, i) => ({ feature: pretty(f), share: entry.importance[f] * 100, color: COLORS[i % COLORS.length] }))
        .sort((a, b) => b.share - a.share)
    : [];

  return (
    <div className="card">
      <h3>Feature Importance</h3>
      {error && <p className="err">{error}</p>}
      {!data && !error && <p className="muted">Calculating feature importance…</p>}
      {data && (
        <>
          <div className="inputs">
            <ModelSelector models={models} value={selected} onChange={setModel} />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rows} layout="vertical" margin={{ left: 24, right: 24 }}>
              <CartesianGrid stroke="#2a3a2f" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} unit="%" stroke="#8aa192" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="feature" width={90} stroke="#8aa192" tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v) => `${Number(v).toFixed(1)}%`}
                cursor={{ fill: "#ffffff0d" }}
                contentStyle={{ background: "#101612", border: "1px solid #2a3a2f" }}
                itemStyle={{ color: "#fff" }}
              />
              <Bar dataKey="share" name="Importance" isAnimationActive={false}>
                {rows.map((r) => <Cell key={r.feature} fill={r.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
