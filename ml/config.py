"""Paths, feature names, label column and seeds for the offline ML pipeline.

After downloading the Kaggle dataset, open it and confirm FEATURES / LABEL_COLUMN
below. Column names are normalised (lower-case, spaces -> underscores) before matching.
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
ARTIFACTS_DIR = Path(os.getenv("ARTIFACTS_DIR", ROOT / "ml" / "artifacts"))

# Feature columns, in the exact order used at training and inference.
# If any are missing from the CSV, preprocess falls back to all numeric columns.
FEATURES = ["throughput", "congestion", "packet_loss", "latency", "jitter"]

# Raw files. Supervised models use LABELED_FILE; unsupervised models are fitted on
# UNLABELED_FILE (the same records without labels). Rows must be in the same order.
LABELED_FILE = "network_dataset_labeled.csv"
UNLABELED_FILE = "network_dataset.csv"

# Overall label column. Per-feature flags (anomaly_throughput, ...) are never used as features.
LABEL_COLUMN = "anomaly"
LABEL_CANDIDATES = ["anomaly", "is_anomaly", "label", "target", "class", "status"]
# String label values that mean "anomaly" (everything else -> normal).
ANOMALY_VALUES = {"anomaly", "anomalous", "abnormal", "attack", "1", "true", "yes"}

# Columns never used as features (IDs, timestamps, free text).
DROP_COLUMNS = ["id", "timestamp", "time", "date", "datetime", "ip", "source", "destination"]

SEED = 42
TEST_SIZE = 0.2

# model id -> (display name, model name)
MODELS = {
    "random_forest": ("Torvalds (RF)", "supervised"),
    "bagging": ("Babbage (BG)", "supervised"),
    "boosting": ("Turing (GB)", "supervised"),
    "stacking": ("Ritchie (ST)", "supervised"),
    "svm": ("Shannon (SVM)", "supervised"),
    "isolation_forest": ("Dijkstra (IF)", "unsupervised"),
    "kmeans": ("Hopper (KM)", "unsupervised"),
}
