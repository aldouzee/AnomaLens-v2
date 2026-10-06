from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, models, predict, stream
from app.core.config import settings
from app.services.model_registry import registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    registry.ensure_loaded()  # models from ARTIFACTS_DIR (skipped if index.py already loaded them)
    yield


app = FastAPI(title="AnomaLens Network Anomaly Detector", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])

for r in (health, models, predict, stream):
    app.include_router(r.router)
