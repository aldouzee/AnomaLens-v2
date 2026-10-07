import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function Dot({ cx, cy, payload }) {
  if (cx == null || cy == null) return null;
  const color = payload.prediction === "anomaly" ? "#ff5d5d" : "#75DA9F";
  // live records are filled dots; single and batch records are rings
  if (payload.source !== "live") return <circle cx={cx} cy={cy} r={5} fill="#0a0d0b" stroke={color} strokeWidth={2} />;
  return <circle cx={cx} cy={cy} r={payload.prediction === "anomaly" ? 5 : 2} fill={color} />;
}

/** data: [{ n, score, prediction, source }] */
export default function AnomalyChart({ data }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#2a3a2f" strokeDasharray="3 3" />
          <XAxis dataKey="n" stroke="#8aa192" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 1]} stroke="#8aa192" tick={{ fontSize: 11 }} />
          <ReferenceLine y={0.5} stroke="#b6f21a" strokeDasharray="4 4" />
          <Tooltip contentStyle={{ background: "#101612", border: "1px solid #2a3a2f" }}
                   formatter={(v, _name, item) => [`${Number(v).toFixed(3)} (${item.payload.source})`, "anomaly score"]} />
          <Line type="monotone" dataKey="score" stroke="#75DA9F" strokeWidth={1.5} dot={<Dot />} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
