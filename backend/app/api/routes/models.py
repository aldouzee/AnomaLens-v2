from fastapi import APIRouter, HTTPException

from app.services.explain import explain_all
from app.services.model_registry import registry

router = APIRouter()


@router.get("/models/explain")
def explain_models():
    """Permutation feature importance for every model (computed on first call, then cached)."""
    if not registry.pipes:
        raise HTTPException(503, "No models loaded. Train models and restart the backend.")
    result = explain_all()
    if result is None:
        raise HTTPException(404, "Feature importance needs stream_sample.csv (labeled test rows) in the artifacts folder")
    return result


@router.get("/models")
def list_models():
    return {
        "features": registry.features,
        "dataset": {k: registry.meta.get(k) for k in ("source", "rows", "anomalies", "anomaly_rate", "test_rows", "test_anomalies")},
        "models": [
            {"id": k, "name": v["name"], "type": v["type"], "metrics": v["metrics"],
             "confusion_matrix": v["confusion_matrix"], "latency_ms": v["latency_ms"]}
            for k, v in registry.info.items()
        ],
    }
