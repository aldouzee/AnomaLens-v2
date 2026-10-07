# AnomaLens – Live Network Anomaly Prediction

See [PROJECT_OVERVIEW.md](project_overview.md) for information and design.

## Quick start (Windows paths shown; use `source .venv/bin/activate` on Linux/macOS)

```bash
# 1. Data: data/raw/network_dataset_labeled.csv (supervised) and network_dataset.csv (unsupervised)

# 2. Train (writes models + metrics.json + stream_sample.csv to ml/artifacts/)
cd ml && python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt
python preprocess.py && python train_supervised.py && python train_unsupervised.py && python evaluate.py
s
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