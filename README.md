# AnomaLens – Live Network Anomaly Prediction

FastAPI + scikit-learn backend, React (Vite) dashboard. See [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) for the design.

## Quick start (Windows paths shown; use `source .venv/bin/activate` on Linux/macOS)

```bash
# 1. Data: data/raw/network_dataset_labeled.csv (supervised) and network_dataset.csv (unsupervised)

# 2. Train (writes models + metrics.json + stream_sample.csv to ml/artifacts/)
cd ml && python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt
python preprocess.py && python train_supervised.py && python train_unsupervised.py && python evaluate.py

# 3. Run everything
cd .. && docker compose up --build        # UI :5173, API :8000, docs :8000/docs
```

Without Docker: `cd backend && pip install -r requirements-dev.txt && uvicorn app.main:app --reload` and
`cd frontend && npm install && npm run dev`.

## Data
- Supervised models (RF, Bagging, SVM) train on `network_dataset_labeled.csv`, label column `anomaly`.
- Unsupervised models (Isolation Forest, K-Means) are fitted on `network_dataset.csv` (no labels), using only the rows
  that fall in the training split; the held-out test rows (with labels) are used to evaluate every model.
- Features: throughput, congestion, packet_loss, latency, jitter. The per-feature `anomaly_*` flags are not used (label leakage).
- Files, features and label are set in `ml/config.py`. `ml/make_synthetic.py` is only a stand-in generator.

## Tests
```bash
cd backend && pip install -r requirements-dev.txt && python -m pytest app/tests    # pass the path explicitly: pytest rejects [ ] in the folder name when run bare
cd frontend && npm test
```

## Notes
- Unsupervised models share one rule: a negative decision value means anomaly (`outlier_label` in `ml/common.py` and `backend/app/services/predictor.py`, tested). K-Means decides by distance to the nearest centroid against a threshold stored in `metrics.json`.
- The About page is static text; model names shown in the UI come from `frontend/src/modelNames.js`.
- scikit-learn ≥1.9 warns that `SVC(probability=True)` is deprecated; it still works, switch to `CalibratedClassifierCV` later.

## Deploying
See [deployment.md](deployment.md) (Vercel). The repository is already prepared: `backend/index.py` (entrypoint), `backend/vercel.json`,
`backend/.python-version` and pinned `backend/requirements.txt`. After retraining, run `python ml/sync_backend_artifacts.py`
to copy the models into `backend/artifacts/`, then commit them.
