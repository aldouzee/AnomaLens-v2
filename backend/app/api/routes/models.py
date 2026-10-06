from fastapi import APIRouter

from app.services.model_registry import registry

router = APIRouter()


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
