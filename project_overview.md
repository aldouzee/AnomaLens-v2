# AnomaLens – Live Network Anomaly Prediction Web App

A web application that evaluates network traffic records as **normal** or **anomalous** in near real time, using seven supervised and unsupervised machine learning models, served through a FastAPI backend and visualised in a React dashboard.

**Status:** viable version (v0.1). The full pipeline works end to end: data → training → API → dashboard. Known limitations are listed in [section 11](#11-known-limitations).

---

## 1. Project Overview

### 1.1 Purpose
Network operators need early warning when link quality degrades or traffic behaves abnormally. This project trains several ML models on network performance metrics and exposes them through an API and a dashboard so that incoming records can be scored (manually, from CSV files, or from a live simulated stream), compared across models, and visualised.

### 1.2 Core Objectives (all implemented)
- Train and compare **supervised** models, including the three ensemble families: Random Forest and **Bagging**, **Boosting** (Gradient Boosting) and **Stacking**, plus SVM.
- Train and compare **unsupervised** models: Isolation Forest and K-Means (distance to nearest centroid).
- Handle class imbalance in the training data using **SMOTE**.
- Serve predictions through a **FastAPI** REST/WebSocket API.
- Provide a **React** dashboard for manual input, batch upload, live stream view and model comparison.
- Package everything with **Docker / Docker Compose**.

### 1.3 Dataset
- Source: Kaggle – *Network Anomaly Dataset* (`kaiser14/network-anomaly-dataset`), stored in `data/raw/`.
- Two files describing the **same 1,001 records in the same order**:
  - `network_dataset_labeled.csv` – adds the label columns. Used by the **supervised** models.
  - `network_dataset.csv` – no labels. Used to fit the **unsupervised** models.
- Features (in this order): **throughput, congestion, packet_loss, latency, jitter**.
- Label: `anomaly` (83 anomalies, **8.3%**). The per-feature flags (`anomaly_throughput`, …) are **not** used as features, because they would leak the label.
- Other columns (timestamp, bandwidth, routers, route and video fields) are ignored.

### 1.4 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (Vite), fetch + WebSocket, Recharts, plain CSS (`styles/app.css`) |
| Backend API | FastAPI, Uvicorn, Pydantic, python-multipart |
| ML | scikit-learn, imbalanced-learn (SMOTE), pandas, NumPy, joblib |
| Containerisation | Docker, Docker Compose |
| Testing | pytest + httpx (backend, 12 tests); Vitest + React Testing Library (frontend, 3 tests) |

---

## 2. System Architecture

```
┌────────────────────┐        HTTP / WebSocket        ┌─────────────────────────┐
│   React Frontend   │ ─────────────────────────────▶ │     FastAPI Backend     │
│  Dashboard, model  │ ◀───────────────────────────── │  /predict, /models,     │
│  comparison, about │        JSON predictions        │  /stats, /ws/stream     │
└────────────────────┘                                └───────────┬─────────────┘
                                                                  │ loads at startup
                                                      ┌───────────▼─────────────┐
                                                      │   Model Registry        │
                                                      │ 7 trained pipelines     │
                                                      │ + metrics.json          │
                                                      └───────────▲─────────────┘
                                                                  │ produced by
                                                      ┌───────────┴─────────────┐
                                                      │   Offline ML Pipeline   │
                                                      │ preprocess → train →    │
                                                      │ evaluate → save         │
                                                      └─────────────────────────┘
```

**Key idea:** training is an *offline* step that writes model artifacts to `ml/artifacts/`. The API only *loads* artifacts (once, at startup) and performs inference. Each saved model is a single scikit-learn pipeline that includes its own scaler, so the backend never rescales by hand. The only server state is an in-memory prediction history (section 5).

---

## 3. Machine Learning Design

### 3.1 Pipeline
Run from `ml/`: `preprocess.py → train_supervised.py → train_unsupervised.py → evaluate.py`.

1. **Load and validate** both raw files. The script checks that the feature columns exist, that the files have the same number of rows, and that the feature values match row for row.
2. **Split** once, stratified 80/20 (`seed 42`): 800 train rows / 201 test rows (17 test anomalies). Both the labeled and unlabeled data use this same split, so **no test row is ever seen during unsupervised fitting**.
3. **Supervised training** on the labeled training rows. Each model is an `imblearn` pipeline of `StandardScaler → SMOTE → classifier`, so SMOTE runs only during fit and the scaler is fit on training data only.
4. **Unsupervised training** on the unlabeled training rows (`StandardScaler → model`). No labels, so no SMOTE.
5. **Evaluate** every model on the untouched test set. Unsupervised calibration (thresholds and score scale) comes from training data only.
6. **Persist** each model as `<id>.joblib`, plus `metrics.json` (feature order, dataset summary, metrics, confusion matrices, latency, calibration) and `stream_sample.csv` (test rows replayed by the live simulator).

### 3.2 Models

| Id | Persona (UI) | Type | Notes |
|---|---|---|---|
| `random_forest` | Torvalds | Supervised, bagging-style ensemble | GridSearchCV (trees, depth) |
| `bagging` | Babbage | Supervised, **bagging** | Decision-tree base; GridSearchCV |
| `boosting` | Turing | Supervised, **boosting** | Gradient Boosting; GridSearchCV (trees, learning rate, depth) |
| `stacking` | Ritchie | Supervised, **stacking** | Random Forest + SVM + Gradient Boosting, combined by logistic regression (5-fold out-of-fold predictions); fixed hyper-parameters |
| `svm` | Shannon | Supervised | RBF kernel, `probability=True` |
| `isolation_forest` | Dijkstra | Unsupervised | `contamination` = anomaly rate observed in the labeled training rows |
| `kmeans` | Hopper | Unsupervised | k chosen by silhouette on the unlabeled training data (k=4); anomaly = distance to nearest centroid above a threshold |

Supervised models are tuned with 5-fold `GridSearchCV` on `f1_macro`, with SMOTE re-applied inside each fold. The persona names are display-only, set in `frontend/src/modelNames.js`.

**Why K-Means instead of LOF:** LOF was the original second unsupervised model. On the same test split K-Means scored far better (ROC-AUC 0.93 vs 0.75, PR-AUC 0.58 vs 0.20) and stayed at 0.92–0.94 ROC-AUC for every k from 3 to 10, so it replaced LOF.

### 3.3 One rule for unsupervised outputs
Every unsupervised model is reduced to a single **decision value: negative = anomaly**.
- Isolation Forest: its `decision_function`.
- K-Means: `threshold − distance to nearest centroid`. The threshold (the farthest 8.3% of training points) is stored in `metrics.json`.

The label mapping (`decision < 0 → 1 = anomaly`) lives in one function, `outlier_label`, in `ml/common.py` and mirrored in `backend/app/services/predictor.py`, and is unit-tested. Scores shown to users are squashed to 0–1 with a sigmoid so that **0.5 is the decision boundary**.

### 3.4 Results (held-out test set: 201 rows, 17 anomalies)

| Model | Precision | Recall | F1 | ROC-AUC | PR-AUC | Latency (single record) |
|---|---|---|---|---|---|---|
| Stacking | 1.00 | 0.82 | **0.90** | 0.99 | 0.92 | ~17 ms |
| Boosting | 0.76 | 0.94 | 0.84 | 1.00 | 0.97 | ~2 ms |
| Random Forest | 0.74 | 0.82 | 0.78 | 0.99 | 0.91 | ~30 ms |
| SVM | 0.74 | 0.82 | 0.78 | 0.98 | 0.87 | ~1 ms |
| Bagging | 0.60 | 0.88 | 0.71 | 0.98 | 0.89 | ~14 ms |
| Isolation Forest | 0.60 | 0.53 | 0.56 | 0.96 | 0.67 | ~26 ms |
| K-Means | 0.50 | 0.65 | 0.56 | 0.93 | 0.58 | ~2 ms |

With only 17 test anomalies, one more or fewer detected anomaly moves recall by about 6 points, so differences of a few points between models are indicative only. Latencies are measured on the development machine and vary between runs.

### 3.5 Pitfalls handled
- **No SMOTE before the split**: SMOTE lives inside the training pipelines.
- **Feature order** is saved in `metrics.json`; the API rejects records with missing or extra features and reorders columns to match training.
- **No label leakage**: per-feature `anomaly_*` flags are excluded; the unsupervised models never see test rows.
- **Imbalance**: an "always normal" model would score 91.7% accuracy, so precision, recall, F1, ROC-AUC and PR-AUC are reported instead of relying on accuracy.

---

## 4. Project Structure

```
anomalens-v0.1/
├── README.md
├── PROJECT_OVERVIEW.md
├── docker-compose.yml
├── .env.example
├── .gitignore
│
├── data/
│   ├── raw/                     # network_dataset.csv, network_dataset_labeled.csv
│   └── processed/               # train.csv, train_unlabeled.csv, test.csv, meta.json
│
├── notebooks/                   # exploration (optional)
│
├── ml/                          # offline training code
│   ├── config.py                # paths, files, features, label, seed, model ids
│   ├── common.py                # decision/score/label conventions
│   ├── preprocess.py            # load, validate, split
│   ├── train_supervised.py      # RF, Bagging, Boosting, Stacking, SVM (+ SMOTE)
│   ├── train_unsupervised.py    # Isolation Forest, K-Means
│   ├── evaluate.py              # metrics, calibration, latency → metrics.json
│   ├── sync_backend_artifacts.py  # copy models into backend/artifacts for deployment
│   ├── make_synthetic.py        # stand-in data generator (not needed with real data)
│   ├── requirements.txt
│   └── artifacts/               # *.joblib, metrics.json, stream_sample.csv
│
├── backend/
│   ├── Dockerfile           # python:3.14-slim, same as training
│   ├── requirements.txt     # versions pinned to match the saved models
│   ├── requirements-dev.txt # + pytest, httpx
│   ├── index.py             # Vercel entrypoint (exposes `app`, loads models)
│   ├── vercel.json          # bundles artifacts/** into the function
│   ├── .python-version
│   ├── artifacts/           # copy of the trained models for deployment (see sync script)
│   └── app/
│       ├── main.py              # FastAPI app, CORS, lifespan model loading
│       ├── core/config.py       # settings from environment variables
│       ├── api/routes/          # health.py (+ /stats), models.py, predict.py, stream.py
│       ├── schemas/packet.py    # Pydantic request/response models
│       ├── services/
│       │   ├── model_registry.py  # loads/caches artifacts
│       │   ├── predictor.py       # inference, label mapping, in-memory stats
│       │   └── simulator.py       # replays test rows as a live feed
│       └── tests/test_api.py
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx              # shell + tabs (Dashboard, Model comparison, About)
        ├── modelNames.js        # persona labels per model id (display only)
        ├── api/client.js        # fetch + WebSocket helpers (auto-reconnect)
        ├── components/
        │   ├── PredictionForm.jsx   # single-record scoring, one model or all
        │   ├── BatchUpload.jsx      # CSV scoring + result download
        │   ├── LivePanel.jsx        # stream controls, score chart, live feed
        │   ├── AnomalyChart.jsx     # score line chart
        │   ├── LiveFeed.jsx
        │   ├── ModelSelector.jsx
        │   └── MetricsTable.jsx
        ├── pages/
        │   ├── Dashboard.jsx        # home page
        │   ├── ModelComparison.jsx
        │   └── About.jsx
        └── styles/app.css
```

---

## 5. Backend API Design

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Service status, loaded model ids, feature order |
| GET | `/models` | Models with type, metrics, confusion matrix, latency; dataset summary; feature list |
| POST | `/predict` | Score one record with a model id, or `"all"` |
| POST | `/predict/batch` | Score a JSON list of records (up to 10,000) |
| POST | `/predict/batch/csv?model=<id>` | Score an uploaded CSV (extra columns ignored) |
| WS | `/ws/stream?model=<id>&rate=<n>` | Push simulated, scored records (rate 0.1–20 per second) |
| GET | `/stats` | Totals, anomaly count and rate, and the 20 most recent predictions (with source) |
| DELETE | `/stats` | Clear the prediction history and counters |

**Example**

```json
POST /predict
{ "model": "boosting",
  "features": { "throughput": 2.0, "congestion": 56.9, "packet_loss": 0.0, "latency": 1012.5, "jitter": 6.4 } }
```
```json
{ "model": "boosting", "prediction": "anomaly", "score": 0.78, "latency_ms": 1.6 }
```
With `"model": "all"` the response is `{ "results": [ … one entry per model … ] }`.

**Errors:** `404` unknown model, `422` missing/extra/non-numeric features or a CSV without the feature columns, `400` unreadable CSV, `503` no models loaded (train first).

**Behaviour notes**
- Models and `metrics.json` are loaded once at startup from `ARTIFACTS_DIR`; **restart the backend after retraining**.
- `/stats` is **in-memory** and resets when the backend restarts. Each recent prediction is tagged `manual` (single-record form) or `live` (stream). Batch uploads count toward the totals but are not listed individually.
- The simulator replays held-out test rows with ±3% noise; each streamed message includes the true label as `actual`.

---

## 6. Frontend Design

Three tabs; the app opens on **Dashboard**.

**Dashboard (home)**
- Summary cards: total scored, anomalies, anomaly rate, models loaded.
- **Live monitor (automatic):** choose a model and rate, start/stop the stream, see connection status. The **anomaly score line chart** plots live records (filled dots) together with records scored manually or by batch (rings); red = anomaly, green = normal, dashed line = 0.5 boundary. The chart shows the selected model's latest 60 points. The live feed table lists streamed records with their true label.
- **Score records (manual):** a single-record form (any model or "All models") and CSV batch upload with a results table and CSV download.
- **Recent predictions:** a table with a Source column (live / manual).
- **Clear history:** below the table; clears the server history and counters and empties the chart and feed.

**Model comparison:** metrics table (precision, recall, F1, ROC-AUC, PR-AUC, accuracy, latency), a bar chart, and a form that shows every model's verdict for the same record.

**About:** static page explaining why fixed thresholds miss anomalies and how the project works.

Models are shown by persona name (Torvalds, Babbage, Turing, Ritchie, Shannon, Dijkstra, Hopper) plus technique, so each is easier to remember. The labels are defined in `frontend/src/modelNames.js` and unknown model ids fall back to the name sent by the API.

---

## 7. Docker Setup

`docker-compose.yml` runs two services:
- **backend** (`python:3.14-slim`, port 8000) with `ml/artifacts` mounted **read-only** at `/app/artifacts`, so models can be retrained without rebuilding the image.
- **frontend** (`node:20-alpine`, Vite dev server, port 5173) with `VITE_API_URL=http://localhost:8000`.

The code is copied into the images at build time, so code changes need `docker compose up --build`; retrained models only need `docker compose restart backend`.

---

## 8. Setup Instructions

The backend finds its models in `ARTIFACTS_DIR` if set, otherwise `backend/artifacts/`, otherwise `ml/artifacts/`.

### 8.1 Prerequisites
Python 3.10+ (developed on 3.14), Node.js 18+ (developed on 22), Docker and Docker Compose.

### 8.2 Data
Place `network_dataset_labeled.csv` and `network_dataset.csv` in `data/raw/`. File names, features and the label column are set in `ml/config.py`.

### 8.3 Train the models
```bash
cd ml
python -m venv .venv && .venv\Scripts\activate      # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python preprocess.py
python train_supervised.py
python train_unsupervised.py
python evaluate.py
```
Output in `ml/artifacts/`: seven `*.joblib` models, `metrics.json` and `stream_sample.csv`.
For deployment also run `python sync_backend_artifacts.py`, which copies them into `backend/artifacts/`.

### 8.4 Run with Docker
```bash
docker compose up --build
```
Frontend http://localhost:5173 · API http://localhost:8000 · API docs http://localhost:8000/docs

### 8.5 Run locally without Docker
```bash
cd backend && pip install -r requirements-dev.txt && uvicorn app.main:app --reload --port 8000
cd frontend && npm install && npm run dev
```

### 8.6 Tests
```bash
cd backend && python -m pytest app/tests     # pass the path; bare `pytest` rejects "[ ]" in this folder's name
cd frontend && npm test
```

### 8.7 Environment variables (`.env.example`)
```
ARTIFACTS_DIR=../ml/artifacts
CORS_ORIGINS=http://localhost:5173
VITE_API_URL=http://localhost:8000
```

### 8.8 After making changes

| Changed | Do this |
|---|---|
| `frontend/src` | Saves hot-reload with `npm run dev`; in Docker run `docker compose up --build` |
| `backend/app` | Auto-reloads with `--reload`; in Docker run `docker compose up --build backend` |
| Model code or data | Re-run the `ml/` scripts, then restart the backend |

### 8.9 Deploying online
The repo is prepared for a two-project Vercel deployment (API from `backend/`, dashboard from `frontend/`); follow [deployment.md](deployment.md). Library versions in `backend/requirements.txt` are pinned to those used for training, and the Python version is `3.14`. Saved `.joblib` models only load with the same scikit-learn version, so retrain and update the pins together.

---

## 9. Development Roadmap

| Phase | Status |
|---|---|
| 1. Data & EDA | Done (real dataset, two aligned files) |
| 2. ML pipeline | Done (7 models, SMOTE in training pipelines) |
| 3. Evaluation | Done (metrics, calibration and latency in `metrics.json`) |
| 4. Backend | Done (registry, predict, batch, stats, tests) |
| 5. Live streaming | Done (simulator + WebSocket) |
| 6. Frontend | Done (dashboard with live and manual scoring, comparison, about) |
| 7. Containerisation | Dockerfiles and Compose provided |
| 7b. Online deployment | Repository prepared for Vercel (entrypoint, pinned versions, bundled models); steps in `deployment.md` |
| 8. Polish | Input validation and error handling done; screenshots and CI still open |

---

## 10. Testing & Quality

- **Backend (12 tests):** health, models, single and "all" prediction, supervised and unsupervised paths (incl. boosting, stacking, K-Means), unknown model, invalid features, CSV batch, WebSocket stream, clear-history, and the decision-to-label mapping.
- **Frontend (3 tests):** the prediction form submits and shows the verdict, reports scored records to the dashboard, and shows API errors.
- **ML:** scripts were run end to end on the real data; there are no automated ML tests yet.

## 11. Known limitations
- **Small test set:** only 17 anomalies, so model rankings are indicative, not conclusive.
- **Live data is simulated:** the stream replays held-out dataset rows, not real telemetry.
- **History is not persistent:** `/stats` resets on backend restart, and the dashboard chart and feed live in the browser page and reset on reload.
- **Docker** files were written but not exercised end to end during development; local runs were verified.
- **SVM probabilities:** scikit-learn ≥ 1.9 deprecates `SVC(probability=True)`; it still works. The SVM verdict (from `predict`) and its score (from `predict_proba`) can disagree close to the 0.5 boundary.
- **Stale file:** an old `ml/artifacts/lof.joblib` from the replaced LOF model may still exist; it is not loaded.
- No authentication, and CORS is limited to the configured origin.

## 12. Possible Extensions
- Model explainability (SHAP / feature importances shown in the UI)
- Threshold tuning slider for anomaly scores
- Persisting predictions in a database (PostgreSQL / SQLite) for history and alerts
- Authentication and role-based access
- CI pipeline (GitHub Actions) to run tests and build images
- Real telemetry ingestion (e.g., SNMP, NetFlow, or Kafka stream) in place of the simulator
- Automated ML tests (no leakage, column order) and a larger or cross-validated evaluation
