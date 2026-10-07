import json

import joblib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sklearn.cluster import KMeans
from sklearn.ensemble import GradientBoostingClassifier, IsolationForest, RandomForestClassifier, StackingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.core.config import settings
from app.main import app
from app.services.predictor import outlier_label

FEATS = ["throughput", "congestion", "packet_loss", "latency", "jitter"]


@pytest.fixture()
def client(tmp_path, monkeypatch):
    rng = np.random.default_rng(0)
    X = rng.normal(size=(200, 5))
    y = (X[:, 0] > 1).astype(int)
    rf = Pipeline([("s", StandardScaler()), ("clf", RandomForestClassifier(n_estimators=10, random_state=0))]).fit(X, y)
    iso = Pipeline([("s", StandardScaler()), ("m", IsolationForest(random_state=0))]).fit(X)
    joblib.dump(rf, tmp_path / "random_forest.joblib")
    gb = Pipeline([("s", StandardScaler()), ("clf", GradientBoostingClassifier(n_estimators=10, random_state=0))]).fit(X, y)
    st = Pipeline([("s", StandardScaler()), ("clf", StackingClassifier(
        [("rf", RandomForestClassifier(n_estimators=5, random_state=0)), ("gb", GradientBoostingClassifier(n_estimators=5))],
        final_estimator=LogisticRegression(), cv=3))]).fit(X, y)
    joblib.dump(gb, tmp_path / "boosting.joblib")
    joblib.dump(st, tmp_path / "stacking.joblib")
    km = Pipeline([("s", StandardScaler()), ("m", KMeans(3, n_init=3, random_state=0))]).fit(X)
    joblib.dump(iso, tmp_path / "isolation_forest.joblib")
    joblib.dump(km, tmp_path / "kmeans.joblib")
    info = {"metrics": {}, "confusion_matrix": {}, "latency_ms": 1.0, "score_scale": 0.1}
    (tmp_path / "metrics.json").write_text(json.dumps({"features": FEATS, "models": {
        "random_forest": {**info, "name": "RF", "type": "supervised"},
        "boosting": {**info, "name": "GB", "type": "supervised"},
        "stacking": {**info, "name": "ST", "type": "supervised"},
        "isolation_forest": {**info, "name": "IF", "type": "unsupervised"},
        "kmeans": {**info, "name": "KM", "type": "unsupervised", "threshold": 2.0},
    }}))
    monkeypatch.setattr(settings, "artifacts_dir", tmp_path)
    with TestClient(app) as c:
        yield c


GOOD = {k: 0.5 for k in FEATS}


def test_health(client):
    r = client.get("/health").json()
    assert r["status"] == "ok" and set(r["models"]) == {"random_forest", "boosting", "stacking", "isolation_forest", "kmeans"}


def test_clear_stats(client):
    client.post("/predict", json={"model": "random_forest", "features": GOOD})
    assert client.get("/stats").json()["total"] >= 1
    r = client.delete("/stats").json()
    assert r["total"] == 0 and r["recent"] == [] and r["anomaly_rate"] == 0.0
    assert client.get("/stats").json()["total"] == 0


def test_models(client):
    assert len(client.get("/models").json()["models"]) == 5


def test_predict_single(client):
    r = client.post("/predict", json={"model": "random_forest", "features": GOOD})
    assert r.status_code == 200
    assert r.json()["prediction"] in ("normal", "anomaly")


def test_predict_unsupervised_and_all(client):
    assert client.post("/predict", json={"model": "isolation_forest", "features": GOOD}).status_code == 200
    far = client.post("/predict", json={"model": "kmeans", "features": {k: 50.0 for k in FEATS}}).json()
    assert far["prediction"] == "anomaly" and far["score"] > 0.5
    near = client.post("/predict", json={"model": "kmeans", "features": GOOD}).json()
    assert near["prediction"] == "normal"
    r = client.post("/predict", json={"model": "all", "features": GOOD}).json()
    assert len(r["results"]) == 5


def test_unknown_model(client):
    assert client.post("/predict", json={"model": "nope", "features": GOOD}).status_code == 404


def test_invalid_features(client):
    assert client.post("/predict", json={"model": "random_forest", "features": {"latency": 1}}).status_code == 422
    assert client.post("/predict", json={"model": "random_forest", "features": {**GOOD, "x": 1}}).status_code == 422
    assert client.post("/predict", json={"model": "random_forest", "features": {**GOOD, "latency": "abc"}}).status_code == 422


def test_batch_csv(client):
    csv = ",".join(FEATS) + "\n" + "\n".join(",".join(["0.1"] * 5) for _ in range(3))
    r = client.post("/predict/batch/csv?model=random_forest", files={"file": ("a.csv", csv, "text/csv")})
    assert r.status_code == 200 and r.json()["count"] == 3


def test_batch_csv_fills_recent(client):
    client.delete("/stats")
    csv = ",".join(FEATS) + "\n" + "\n".join(",".join([str(i)] * 5) for i in range(3))
    client.post("/predict/batch/csv?model=random_forest", files={"file": ("a.csv", csv, "text/csv")})
    s = client.get("/stats").json()
    assert s["total"] == 3 and len(s["recent"]) == 3
    assert {r["source"] for r in s["recent"]} == {"batch"}
    assert s["recent"][0]["features"]["latency"] == 2.0  # newest (last CSV row) first


def test_explain_needs_labeled_sample(client):
    assert client.get("/models/explain").status_code == 404


def test_explain_feature_importance(client):
    rng = np.random.default_rng(1)
    X = rng.normal(size=(120, 5))
    sample = pd.DataFrame(X, columns=FEATS).assign(label=(X[:, 0] > 1).astype(int))  # label depends on throughput only
    sample.to_csv(settings.artifacts_dir / "stream_sample.csv", index=False)
    r = client.get("/models/explain")
    assert r.status_code == 200
    body = r.json()
    assert body["features"] == FEATS and len(body["models"]) == 5
    rf = next(m for m in body["models"] if m["id"] == "random_forest")
    assert max(rf["importance"], key=rf["importance"].get) == "throughput"
    assert abs(sum(rf["importance"].values()) - 1) < 1e-3


def test_stream(client):
    with client.websocket_connect("/ws/stream?model=random_forest&rate=20") as ws:
        msg = ws.receive_json()
    assert msg["prediction"] in ("normal", "anomaly")


def test_outlier_label_mapping():
    assert outlier_label([-0.2, 0.3, 0.0, -1]).tolist() == [1, 0, 0, 1]


@pytest.mark.parametrize("model", ["boosting", "stacking"])
def test_predict_ensembles(client, model):
    r = client.post("/predict", json={"model": model, "features": GOOD})
    assert r.status_code == 200 and 0 <= r.json()["score"] <= 1
