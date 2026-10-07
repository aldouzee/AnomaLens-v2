"""Global feature importance by permutation.

For each model and feature: shuffle that feature on the held-out test rows (stream_sample.csv) and measure how much
the model's ROC-AUC drops. A bigger drop means the model relies on that feature more. Works for every model type
(supervised and unsupervised) because it only uses the model's score. Results are cached per artifacts directory.
"""
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

from app.core.config import settings
from app.services.model_registry import registry
from app.services.predictor import score_frame

REPEATS = 5
SEED = 42

_cache: dict = {}


def load_sample() -> pd.DataFrame | None:
    """Labeled held-out rows, or None if the sample file is missing or unusable."""
    path = settings.artifacts_dir / "stream_sample.csv"
    if not path.exists():
        return None
    df = pd.read_csv(path)
    if not ({*registry.features, "label"} <= set(df.columns)) or df["label"].nunique() < 2:
        return None
    return df


def permutation_importance(name: str, X: pd.DataFrame, y: pd.Series) -> dict:
    rng = np.random.default_rng(SEED)
    baseline = roc_auc_score(y, score_frame(name, X)[1])
    drops = {}
    for f in X.columns:
        runs = []
        for _ in range(REPEATS):
            shuffled = X.copy()
            shuffled[f] = rng.permutation(shuffled[f].to_numpy())
            runs.append(baseline - roc_auc_score(y, score_frame(name, shuffled)[1]))
        drops[f] = max(float(np.mean(runs)), 0.0)  # a negative drop is noise, treat it as no importance
    total = sum(drops.values())
    return {
        "id": name,
        "baseline_auc": round(float(baseline), 4),
        "auc_drop": {f: round(d, 4) for f, d in drops.items()},
        "importance": {f: round(d / total, 4) if total > 0 else 0.0 for f, d in drops.items()},  # share of the total drop
    }


def explain_all() -> dict | None:
    """Importance for every loaded model, or None when there is no labeled sample to measure on."""
    key = settings.artifacts_dir
    if key in _cache:
        return _cache[key]
    sample = load_sample()
    if sample is None:
        return None
    X, y = sample[registry.features], sample["label"]
    result = {
        "method": "permutation",
        "metric": "roc_auc",
        "test_rows": len(sample),
        "features": registry.features,
        "models": [permutation_importance(n, X, y) for n in registry.names()],
    }
    _cache[key] = result
    return result
