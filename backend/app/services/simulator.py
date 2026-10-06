"""Generates live traffic: replays held-out test rows (with small perturbation), or
synthesises records from the feature ranges if no sample file exists."""
import random
from collections.abc import Iterator

import pandas as pd

from app.core.config import settings
from app.services.model_registry import registry


def _load_sample() -> pd.DataFrame | None:
    path = settings.artifacts_dir / "stream_sample.csv"
    if not path.exists():
        return None
    df = pd.read_csv(path)
    return df if set(registry.features) <= set(df.columns) else None


def stream(noise: float = 0.03) -> Iterator[tuple[dict, str | None]]:
    """Yield (features, actual_label_or_None) forever."""
    sample = _load_sample()
    while True:
        if sample is not None:
            row = sample.sample(1).iloc[0]
            feats = {f: float(row[f]) * (1 + random.uniform(-noise, noise)) for f in registry.features}
            actual = ("anomaly" if int(row["label"]) == 1 else "normal") if "label" in sample.columns else None
        else:
            feats = {f: random.uniform(0, 100) for f in registry.features}
            actual = None
        yield feats, actual
