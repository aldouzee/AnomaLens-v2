import { modelLabel } from "../modelNames.js";

export default function ModelSelector({ models = [], value, onChange, allowAll = false, label = "Model" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {allowAll && <option value="all">All models</option>}
        {models.map((m) => (
          <option key={m.id} value={m.id}>{modelLabel(m.id, m.name)} ({m.type})</option>
        ))}
      </select>
    </label>
  );
}
