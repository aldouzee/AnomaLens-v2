import { Badge } from "./PredictionForm.jsx";

export default function LiveFeed({ items, features }) {
  return (
    <div className="scroll feed">
      <table className="tbl">
        <thead><tr><th>#</th>{features.map((f) => <th key={f}>{f}</th>)}<th>Verdict</th><th>Score</th><th>Actual</th></tr></thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.n} className={m.prediction === "anomaly" ? "hot" : ""}>
              <td>{m.n}</td>
              {features.map((f) => <td key={f}>{m.features[f].toFixed(2)}</td>)}
              <td><Badge verdict={m.prediction} /></td><td>{m.score.toFixed(3)}</td><td>{m.actual ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
