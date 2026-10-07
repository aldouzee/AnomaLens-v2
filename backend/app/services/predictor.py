"""Inference and label mapping. Convention: 1 = anomaly, 0 = normal."""
import time
from collections import deque

import numpy as np
import pandas as pd
from fastapi import HTTPException

from app.services.model_registry import registry


class Stats:
    """In-memory counters for the dashboard summary cards."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.total = 0
        self.anomalies = 0
        self.recent: deque = deque(maxlen=100)

    def add(self, model: str, labels, scores, features=None, source: str = "single"):
        self.total += len(labels)
        self.anomalies += int(np.sum(labels))
        if features is None:
            return
        # a single record is a dict; a batch is a list of dicts, one per label/score (oldest first)
        rows = features if isinstance(features, list) else [features]
        for f, label, score in zip(rows, labels[-len(rows):], scores[-len(rows):]):
            self.recent.appendleft({"model": model, "source": source, "features": f,
                                    "prediction": label_name(label), "score": float(score)})


stats = Stats()


def label_name(v) -> str:
    return "anomaly" if int(v) == 1 else "normal"


def outlier_label(decision):
    """decision < 0 -> 1 (anomaly), else 0 (normal). The one place this mapping lives."""
    return (np.asarray(decision) < 0).astype(int)


def decision_values(pipe, X, info):
    """Unsupervised decision: negative = outlier. K-Means stores a distance threshold in its metadata."""
    if "threshold" in info:
        return info["threshold"] - pipe.transform(X).min(axis=1)
    return pipe.decision_function(X)


def to_frame(records: list[dict]) -> pd.DataFrame:
    """Build a frame in the training feature order, rejecting missing/unknown features."""
    feats = registry.features
    for r in records:
        missing, extra = set(feats) - set(r), set(r) - set(feats)
        if missing or extra:
            raise HTTPException(422, f"features must be exactly {feats}; missing={sorted(missing)} unexpected={sorted(extra)}")
    return pd.DataFrame(records)[feats]


def require_model(name: str):
    if not registry.pipes:
        raise HTTPException(503, "No models loaded. Train models and restart the backend.")
    if name not in registry.pipes:
        raise HTTPException(404, f"Unknown model '{name}'. Available: {registry.names()}")


def score_frame(name: str, X: pd.DataFrame):
    """Returns (labels, scores) arrays for the chosen model."""
    require_model(name)
    pipe, info = registry.get(name)
    if info["type"] == "unsupervised":
        d = decision_values(pipe, X, info)
        labels = outlier_label(d)
        scores = 1.0 / (1.0 + np.exp(np.clip(d / info.get("score_scale", 1.0) * 3.0, -50, 50)))
    else:
        labels = np.asarray(pipe.predict(X)).astype(int)
        scores = pipe.predict_proba(X)[:, 1]
    return labels, scores


def predict_one(name: str, features: dict) -> dict:
    X = to_frame([features])
    t0 = time.perf_counter()
    labels, scores = score_frame(name, X)
    ms = (time.perf_counter() - t0) * 1000
    stats.add(name, labels, scores, features)
    return {"model": name, "prediction": label_name(labels[0]), "score": round(float(scores[0]), 4),
            "latency_ms": round(ms, 2)}
