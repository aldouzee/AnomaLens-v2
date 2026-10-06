"""Shared scoring and label conventions (1 = anomaly, 0 = normal).

Every unsupervised model is reduced to one number, the *decision*: negative = outlier.
  - Isolation Forest: its decision_function.
  - K-Means: (threshold - distance to nearest centroid); the threshold is stored in metrics.json.
"""
import numpy as np


def outlier_label(decision):
    """Single place where a decision value becomes a label: decision < 0 -> 1 (anomaly), else 0."""
    return (np.asarray(decision) < 0).astype(int)


def decision(pipe, X, info=None):
    if info and "threshold" in info:  # distance-based model (K-Means)
        return info["threshold"] - pipe.transform(X).min(axis=1)
    return pipe.decision_function(X)


def predict_labels(pipe, kind, X, info=None):
    if kind == "unsupervised":
        return outlier_label(decision(pipe, X, info))
    return np.asarray(pipe.predict(X)).astype(int)


def anomaly_scores(pipe, kind, X, info=None):
    """Higher = more anomalous, in [0, 1]; 0.5 sits on the decision boundary for unsupervised models."""
    if kind == "unsupervised":
        d = decision(pipe, X, info)
        scale = (info or {}).get("score_scale", 1.0)
        return 1.0 / (1.0 + np.exp(np.clip(d / scale * 3.0, -50, 50)))
    return pipe.predict_proba(X)[:, 1]
