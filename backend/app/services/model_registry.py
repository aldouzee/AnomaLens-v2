"""Loads and caches trained artifacts (read-only) produced by the offline ML pipeline."""
import json
import logging

import joblib

from app.core.config import settings

log = logging.getLogger("registry")


class ModelRegistry:
    def __init__(self):
        self.features: list[str] = []
        self.info: dict[str, dict] = {}   # id -> metadata from metrics.json
        self.pipes: dict[str, object] = {}
        self.meta: dict = {}
        self._loaded_from = None

    def ensure_loaded(self):
        """Load once per artifacts directory (safe to call from the lifespan and from index.py)."""
        if self._loaded_from != settings.artifacts_dir:
            self.load_all()

    def load_all(self):
        self.features, self.info, self.pipes, self.meta = [], {}, {}, {}
        self._loaded_from = settings.artifacts_dir
        path = settings.artifacts_dir / "metrics.json"
        if not path.exists():
            log.warning("no metrics.json in %s; train the models first", settings.artifacts_dir)
            return
        self.meta = json.loads(path.read_text())
        self.features = self.meta["features"]
        for name, info in self.meta["models"].items():
            f = settings.artifacts_dir / f"{name}.joblib"
            if f.exists():
                self.pipes[name] = joblib.load(f)
                self.info[name] = info
            else:
                log.warning("missing artifact %s", f)

    def names(self) -> list[str]:
        return list(self.pipes)

    def get(self, name: str):
        return self.pipes[name], self.info[name]


registry = ModelRegistry()
