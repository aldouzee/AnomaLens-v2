import logo from "../assets/logos/anomalens_logo.svg";
import { personaName } from "../modelNames.js";

const PROBLEMS = [
  ["Slow creep", "Delay and jitter build up gradually, so no single reading looks alarming."],
  ["Silent loss", "Packets disappear and throughput drops while the link still appears \"up\"."],
  ["Alarm fatigue", "Fixed thresholds raise false alarms until real ones get ignored."],
];

const STEPS = [
  ["Data", "1,001 network records with five measurements each."],
  ["Models", "Seven trained models: five learn from labeled examples (supervised), two learn only what \"normal\" looks like (unsupervised)."],
  ["API", "A FastAPI service loads the models once and scores records in milliseconds, by single record, batch or live stream."],
  ["Dashboard", "A React interface for scoring, monitoring, history and model comparison."],
];

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

const FIGURES = [
  ["Records", "1,001"],
  ["Anomalies", "83 (8.3%)"],
  ["Input features", "5"],
  ["Train / test split", "800 / 201"],
];

const DATA_USE = [
  ["Two matching files.", "The dataset comes as two files describing the same records in the same order: a labeled version (used to train the supervised models) and an unlabeled version (used to fit the unsupervised models)."],
  ["One split, no peeking.", "The data is split once, 80% for learning and 20% for testing (the test set contains 17 anomalies). Both labeled and unlabeled data use the same split, so no test record is ever seen while training any model."],
  ["Balancing the classes.", "Supervised models are trained with SMOTE, a technique that creates realistic extra examples of the rare anomaly class by blending real ones. It is applied only inside training, never to test data."],
  ["Labels kept out of the inputs.", "The dataset also contains per-feature anomaly flags. We deliberately do not use them as inputs, because they are derived from the answer and would make the results look better than they really are."],
  ["Columns we ignore.", "Timestamp, bandwidth, router, route and video fields are not used."],
  ["The live stream.", "The Live Monitor replays held-out test records with a little random noise (about ±3%). It is a simulation, not real network telemetry."],
];

const SIGNALS = [
  ["Throughput", "How much data is actually delivered over the link", "A sudden drop means the link is delivering far less than it should, even if it still appears connected."],
  ["Congestion", "How heavily loaded the network path is", "High load can push delay and loss up and throughput down, often a warning sign before failure."],
  ["Packet loss", "The share of data packets that never arrive", "Lost packets cause retransmissions, stalls and broken calls; a rise is a classic symptom of trouble."],
  ["Latency", "How long data takes to travel across the network", "Very high or rapidly rising delay makes services feel slow or unresponsive."],
  ["Jitter", "How much the delay varies from packet to packet", "Uneven delay damages real-time services such as video and voice, even when average latency looks fine."],
];

const TRUST = [
  "SMOTE inside the training pipeline, so synthetic examples never leak into evaluation.",
  "No label leakage, because per-feature anomaly flags are excluded.",
  "Fair metrics: precision, recall, F1, ROC-AUC and PR-AUC instead of accuracy alone.",
  "One decision rule for all models, with 0.5 as the boundary, so results are comparable.",
  "Input checks: the API rejects records with missing, extra or non-numeric features.",
];

const LIMITS = [
  "The test set contains only 17 anomalies, so model rankings are indicative, not conclusive.",
  "The live stream replays dataset records; it is not real telemetry.",
  "Prediction history is kept in memory and resets when the backend restarts.",
  "Most normal records score close to 0, so the Packet Score chart can look flat for them.",
  "AnomaLens is a learning and demonstration project; it has no authentication and is not a production monitoring system.",
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
          AnomaLens scores network measurements as <b>normal</b> or <b>anomalous</b> in near real time. It compares seven machine-learning
          models side by side, so you can see not only what is flagged, but which kind of model flags it and why.
        </p>
        <div className="about-actions">
          <button className="btn" onClick={() => onNavigate?.("dashboard")}>Open the dashboard</button>
          <button className="btn ghost" onClick={() => onNavigate?.("compare")}>Compare the models</button>
        </div>
      </header>

      <section className="about-sec" aria-labelledby="about-problem">
        <h2 id="about-problem">The problem</h2>
        <p className="about-text"><b>Networks fail quietly before they fail loudly.</b> Every network link produces a steady stream of measurements. When a link starts to go bad, delay creeps up, packets go missing and the connection becomes uneven. By the time someone notices, video calls freeze, online services slow down and users are already affected.</p>
        <p className="about-text"><b>Fixed alarms are not enough.</b> The traditional defence is an alarm when one number crosses a fixed line. But real trouble often hides in unusual <i>combinations</i> of signals, and a single threshold either misses it or triggers so many false alarms that people stop trusting it.</p>
        <p className="about-text"><b>Anomalies are rare, which makes them hard to learn.</b> In our data only about 1 record in 12 is an anomaly (8.3%). A lazy detector that always answers "normal" would be right 91.7% of the time and still catch nothing. Finding the rare bad moments, without crying wolf, is the real challenge.</p>
        <div className="about-grid">
          {PROBLEMS.map(([title, text]) => (
            <div key={title} className="card about-card"><h3>{title}</h3><p className="muted">{text}</p></div>
          ))}
        </div>
        <p className="about-text"><b>Who it helps:</b> network operators who need an early warning and a second opinion, and students who want to see how different learning methods think about the same problem.</p>
      </section>

      <section className="about-sec" aria-labelledby="about-solution">
        <h2 id="about-solution">Our solution</h2>
        <p className="about-text">AnomaLens turns raw network measurements into a clear verdict. We trained <b>seven models</b> on real network data, put them behind one API, and built a dashboard where you can score records, watch a live stream, and compare the models head to head.</p>
        <div className="about-grid">
          {STEPS.map(([title, text], i) => (
            <div key={title} className="card about-card">
              <small className="muted">Step {i + 1}</small>
              <h3>{title}</h3>
              <p className="muted">{text}</p>
            </div>
          ))}
        </div>
        <p className="about-text"><b>One simple rule for every model.</b> Every model's answer is turned into a score between 0 and 1. <b>0.5 is the decision boundary</b>: above it a record is flagged as an anomaly (red, labeled "Anomaly"), below it the record looks normal (green, labeled "Normal"). Because all seven models follow the same rule, their verdicts can be compared fairly.</p>

        <h3>Meet the seven models</h3>
        <p className="muted about-text">Each model has a persona named after a figure in computing, to make its way of thinking easier to remember. The names are display labels only; they do not change how a model works, and they are tributes rather than claims that these people invented the methods.</p>
        <div className="about-grid">
          {MODELS.map(([id, technique, type, text]) => (
            <div key={id} className="card about-card">
              <h3>{personaName(id)}</h3>
              <small className="muted">{technique} · {type}</small>
              <p className="muted">{text}</p>
            </div>
          ))}
        </div>

        <h3>What you can do in the app</h3>
        <div className="about-grid">
          {APP_FEATURES.map(([title, text]) => (
            <div key={title} className="card about-card"><h3>{title}</h3><p className="muted">{text}</p></div>
          ))}
        </div>

        {info?.models?.length > 0 && (
          <div className="card about-card">
            <h3>How well does it work?</h3>
            <Highlights models={info.models} />
            <p className="muted small">See the full comparison on the Model comparison tab.</p>
          </div>
        )}
      </section>

      <section className="about-sec" aria-labelledby="about-dataset">
        <h2 id="about-dataset">The dataset</h2>
        <p className="about-text">AnomaLens learns from the <b>Network Anomaly Dataset</b> published on Kaggle (<code>kaiser14/network-anomaly-dataset</code>): <b>1,001 records</b> of network measurements, of which <b>83 (8.3%)</b> are labeled anomalies. Each record is described by five measurements: throughput, congestion, packet loss, latency and jitter.</p>
        <div className="card about-figures">
          {FIGURES.map(([label, value]) => (
            <div key={label} className="stat"><small className="muted">{label}</small><div className="about-figure">{value}</div></div>
          ))}
        </div>
        <ul className="about-list">
          {DATA_USE.map(([lead, text]) => <li key={lead}><b>{lead}</b> {text}</li>)}
        </ul>
      </section>

      <section className="about-sec" aria-labelledby="about-features">
        <h2 id="about-features">Significant features</h2>
        <p className="about-text">AnomaLens judges every record from five measurements. Individually each can look harmless; anomalies are often revealed by how they <b>move together</b>.</p>
        <div className="about-grid">
          {SIGNALS.map(([name, measures, why]) => (
            <div key={name} className="card about-card">
              <h3>{name}</h3>
              <p><b>{measures}.</b></p>
              <p className="muted">{why}</p>
            </div>
          ))}
        </div>
        <p className="about-text"><b>An example.</b> In the example used in the app's API documentation, a record with near-zero throughput (2.0), high congestion (56.9) and latency above one second (1012.5) is flagged as an anomaly by Boosting (Turing) with a score of 0.78: delivery collapses at the same time as delay explodes. No one of those numbers tells the whole story, but together they do.</p>

        <h3>How AnomaLens shows which features matter</h3>
        <p className="about-text">The <b>Feature Importance</b> card on the Model comparison tab uses <b>permutation importance</b>. For a chosen model, the app shuffles one feature at a time on the held-out test records and records how much the model's ROC-AUC (its ability to separate anomalies from normal records) drops. A bigger drop means the model relies more on that feature, and the chart shows each feature's share of the total drop. It works for all seven models, supervised and unsupervised, because it only needs each model's score.</p>
        <p className="about-text"><b>How to read it:</b> different models can lean on different features, and that is useful information. If two models disagree on a record, the chart helps explain what each one was paying attention to overall. <b>What it is not:</b> a <i>global</i> view of which inputs matter in general. It does not explain one individual prediction, and it is not SHAP.</p>
        <div><button className="btn" onClick={() => onNavigate?.("compare")}>See feature importance</button></div>

        <h3>Design choices that make detection trustworthy</h3>
        <ul className="about-list">{TRUST.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>

      <section className="about-sec" aria-labelledby="about-limits">
        <h2 id="about-limits">Honest limits</h2>
        <ul className="about-list">{LIMITS.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>
    </>
  );
}
