import { modelLabel } from "../modelNames.js";

const COLS = [
  ["precision", "Precision"], ["recall", "Recall"], ["f1", "F1"],
  ["roc_auc", "ROC-AUC"], ["pr_auc", "PR-AUC"], ["accuracy", "Accuracy"],
];

export default function MetricsTable({ models }) {
  return (
    <div className="scroll">
      <table className="tbl">
        <thead><tr><th>Model</th><th>Type</th>{COLS.map(([, l]) => <th key={l}>{l}</th>)}<th>Latency</th></tr></thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.id}>
              <td><b>{modelLabel(m.id, m.name)}</b></td><td>{m.type}</td>
              {COLS.map(([k]) => <td key={k}>{m.metrics[k].toFixed(3)}</td>)}
              <td>{m.latency_ms.toFixed(1)} ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
