from typing import Literal, Optional, Union

from pydantic import BaseModel, Field

Features = dict[str, float]


class PredictRequest(BaseModel):
    model: str = Field("random_forest", description="Model id, or 'all'")
    features: Features


class BatchRequest(BaseModel):
    model: str = "random_forest"
    records: list[Features] = Field(min_length=1, max_length=10_000)


class Prediction(BaseModel):
    model: str
    prediction: Literal["normal", "anomaly"]
    score: float
    latency_ms: float


class AllPredictions(BaseModel):
    results: list[Prediction]


PredictResponse = Union[Prediction, AllPredictions]


class BatchRow(BaseModel):
    features: Features
    prediction: Literal["normal", "anomaly"]
    score: float


class BatchResponse(BaseModel):
    model: str
    count: int
    anomalies: int
    latency_ms: float
    rows: list[BatchRow]


class StreamMessage(BaseModel):
    ts: float
    model: str
    features: Features
    prediction: Literal["normal", "anomaly"]
    score: float
    actual: Optional[Literal["normal", "anomaly"]] = None
