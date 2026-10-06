from fastapi import APIRouter

from app.services.model_registry import registry
from app.services.predictor import stats

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "models": registry.names(), "features": registry.features}


def _snapshot():
    rate = stats.anomalies / stats.total if stats.total else 0.0
    return {"total": stats.total, "anomalies": stats.anomalies, "anomaly_rate": rate, "recent": list(stats.recent)}


@router.get("/stats")
def get_stats():
    return _snapshot()


@router.delete("/stats")
def clear_stats():
    """Clear the prediction history and summary counters."""
    stats.reset()
    return _snapshot()
