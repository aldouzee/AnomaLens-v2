const WHY = [
  ["Earlier detection", "Deviations surface before users notice a slowdown or an outage."],
  ["Learned baselines", "Models learn each metric's normal pattern instead of relying on one fixed threshold."],
  ["Security signal", "Passive and active attacks leave traces in traffic well before the damage is visible."],
  ["Capacity planning", "The same history forecasts which links and devices will run short."],
];

const SPIKE = 34;
const POINTS = Array.from({ length: 48 }, (_, i) => 50 + Math.sin(i / 3.2) * 12 + Math.sin(i * 1.7) * 3 + (i === SPIKE ? -34 : 0));

function Sparkline() {
  const path = POINTS.map((y, i) => `${i ? "L" : "M"}${i * 12.4},${y}`).join(" ");
  const x = SPIKE * 12.4;
  return (
    <svg viewBox="0 0 580 110" className="spark" role="img" aria-label="Metric with learned baseline band and one anomaly">
      <rect x="0" y="26" width="580" height="48" className="band" />
      <path d={path} className="line" fill="none" />
      <circle cx={x} cy={POINTS[SPIKE]} r="6" className="alert" />
      <text x={x + 12} y={POINTS[SPIKE] - 4} className="label">ANOMALY</text>
    </svg>
  );
}

const MODEL_GROUPS = [
  ["Supervised", "Random Forest, Bagging, Boosting, Stacking and SVM learn from labeled records. SMOTE balances the rare anomaly class during training only."],
  ["Unsupervised", "Isolation Forest and K-Means learn what normal traffic looks like from unlabeled records and flag whatever sits far from it."],
];

export default function About({ onNavigate }) {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <>
      <header className="hero">
        <h1>Spot the threat<br />before it <span className="g">spreads.</span></h1>
        <p className="lead">AnomaLens learns network behavior and spot anomalies on the fly.</p>
        <div className="cta">
          <button className="btn" onClick={() => onNavigate("dashboard")}>Open dashboard</button>
          <button className="btn ghost" onClick={() => onNavigate("compare")}>See the models</button>
          <button className="btn ghost" onClick={() => scrollTo("concept")}>How it works</button>
        </div>
      </header>

      <section id="concept" className="sec">
        <p className="eyebrow">// 01 · concept</p>
        <h2>Why fixed thresholds <span className="g">miss</span> anomalies</h2>
        <p className="muted wide">A fixed limit only fires once a number is crossed. A slow drift, an odd-hour traffic shift or a steadily climbing error rate all stay under the line. Anomaly detection compares live values against a learned normal range instead.</p>
        <div className="card"><Sparkline /></div>
        <div className="why">
          <div className="why-title">Why it matters</div>
          {WHY.map(([title, text]) => <div key={title} className="why-item"><b>{title}</b><p>{text}</p></div>)}
        </div>
      </section>

      <section id="project" className="sec">
        <p className="eyebrow">// 02 · the project</p>
        <h2>How <span className="g">AnomaLens</span> works</h2>
        <p className="muted wide">Network records (throughput, congestion, packet loss, latency and jitter) are scored as normal or anomalous by seven models trained offline on the Kaggle Network Anomaly Dataset (kaiser14/network-anomaly-dataset). A FastAPI backend serves the trained models, and this dashboard scores records manually, from CSV files or from a live simulated stream.</p>
        <div className="cols">
          {MODEL_GROUPS.map(([title, text]) => <div key={title} className="card"><h3>{title}</h3><p className="muted">{text}</p></div>)}
        </div>
      </section>
    </>
  );
}
