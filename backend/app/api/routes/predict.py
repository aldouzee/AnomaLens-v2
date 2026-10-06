import io
import time

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.packet import BatchRequest, BatchResponse, PredictRequest, PredictResponse
from app.services.model_registry import registry
from app.services.predictor import label_name, require_model, score_frame, stats, to_frame, predict_one

router = APIRouter()


@router.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if req.model == "all":
        if not registry.pipes:
            require_model("all")
        return {"results": [predict_one(n, req.features) for n in registry.names()]}
    require_model(req.model)
    return predict_one(req.model, req.features)


def _run_batch(model: str, records: list[dict]) -> dict:
    require_model(model)
    X = to_frame(records)
    t0 = time.perf_counter()
    labels, scores = score_frame(model, X)
    ms = (time.perf_counter() - t0) * 1000
    stats.add(model, labels, scores)
    return {
        "model": model, "count": len(records), "anomalies": int(labels.sum()), "latency_ms": round(ms, 2),
        "rows": [{"features": r, "prediction": label_name(l), "score": round(float(s), 4)}
                 for r, l, s in zip(records, labels, scores)],
    }


@router.post("/predict/batch", response_model=BatchResponse)
def predict_batch(req: BatchRequest):
    return _run_batch(req.model, req.records)


@router.post("/predict/batch/csv", response_model=BatchResponse)
async def predict_batch_csv(model: str = "random_forest", file: UploadFile = File(...)):
    try:
        df = pd.read_csv(io.BytesIO(await file.read()))
    except Exception:
        raise HTTPException(400, "Could not parse the uploaded file as CSV")
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    missing = set(registry.features) - set(df.columns)
    if missing:
        raise HTTPException(422, f"CSV is missing columns: {sorted(missing)}")
    df = df[registry.features].apply(pd.to_numeric, errors="coerce").dropna().head(10_000)
    if df.empty:
        raise HTTPException(422, "CSV has no valid numeric rows")
    return _run_batch(model, df.to_dict("records"))
