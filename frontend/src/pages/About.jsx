import logo from "../assets/logos/anomalens_logo.svg";
import { personaName } from "../modelNames.js";

// [model id, technique, type, how it thinks]; persona names come from modelNames.js
const MODELS = [
  ["random_forest", "Random Forest", "Supervised", "A crowd of decision trees that each vote; the majority wins."],
  ["bagging", "Bagging", "Supervised", "Many trees trained on different random re-samples of the data, then averaged."],
  ["boosting", "Boosting", "Supervised", "Learns from its mistakes: each new tree focuses on what the last one got wrong."],
  ["stacking", "Stacking", "Supervised", "A committee chair: Random Forest, SVM and Boosting give opinions, and a final model weighs them."],
  ["svm", "SVM", "Supervised", "Draws the cleanest possible boundary between normal and anomalous."],
  ["isolation_forest", "Isolation Forest", "Unsupervised", "Looks for records that are unusually easy to isolate from the rest."],
  ["kmeans", "K-Means", "Unsupervised", "Groups normal behaviour into clusters; anything far from every cluster is flagged."],
];

const APP_FEATURES = [
  ["Live Monitor", "Streams simulated records through a chosen model and plots each score on the Packet Score chart."],
  ["Manual Scoring", "Scores one record (any model, or all models at once) or a whole CSV file."],
  ["Recent Network Predictions", "Shows the latest predictions tagged Live, Single or Batch; download them as CSV or clear the history."],
  ["Model Arena", "Compares precision, recall, F1, ROC-AUC, PR-AUC, accuracy and speed for all seven models."],
  ["Feature Importance", "Shows which of the five measurements each model relies on most."],
];

/** Best-F1 and highest-recall sentences, read from the loaded metrics so they never go stale. */
function Highlights({ models }) {
  const by = (key) => [...models].sort((a, b) => b.metrics[key] - a.metrics[key])[0];
  const f1 = by("f1");
  const recall = by("recall");
  return (
    <p className="muted">
      On the held-out test set, <b>{personaName(f1.id, f1.name)}</b> ({f1.name}) has the best balance, with an F1 of {f1.metrics.f1.toFixed(2)}.{" "}
      <b>{personaName(recall.id, recall.name)}</b> ({recall.name}) catches the most anomalies, with a recall of {recall.metrics.recall.toFixed(2)}.
    </p>
  );
}

export default function About({ info, onNavigate }) {
  return (
    <>
      <header className="about-hero">
        <img src={logo} alt="" />
        <h1>Spot network trouble before your users do.</h1>
        <p className="about-lead">
          <b>AnomaLens</b> scores network measurements as <b>normal</b> or <b>anomalous</b> in near real time. It compares seven machine-learning
          models side by side, so you can see not only what is flagged, but which kind of model flags it and why.
        </p>
        <div className="about-actions">
          <button className="btn" onClick={() => onNavigate?.("dashboard")}>Dashboard</button>
          <button className="btn ghost" onClick={() => onNavigate?.("compare")}>Model Comparison</button>
        </div>
      </header>

      <section className="about-sec" aria-labelledby="about-solution">

        <h2>The Seven Personas</h2>
        <div className="about-grid">
          {MODELS.map(([id, technique, type, text]) => (
            <div key={id} className="card about-card">
              <h3>{personaName(id)}</h3>
              <small className="muted">{technique} · {type}</small>
              <p className="muted">{text}</p>
            </div>
          ))}
        </div>

        <h2>App Features</h2>
        <div className="about-grid">
          {APP_FEATURES.map(([title, text]) => (
            <div key={title} className="card about-card"><h3>{title}</h3><p className="muted">{text}</p></div>
          ))}
        </div>
      </section>
    </>
  );
}
