export default function StatsCard({ stats, modelCount }) {
  const items = [
    ["Total scored", stats?.total ?? 0],
    ["Anomalies", stats?.anomalies ?? 0, "bad"],
    ["Anomaly rate", <>{((stats?.anomaly_rate ?? 0) * 100).toFixed(1)}<span>%</span></>]
  ];
  return (
    <div className="card stats-card">
      {items.map(([label, value, tone]) => (
        <div key={label} className="stat">
          <small className="muted">{label}</small>
          <div className={`kv ${tone ?? ""}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}
