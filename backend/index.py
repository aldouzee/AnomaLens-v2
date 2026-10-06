"""Vercel entrypoint: Vercel serves the FastAPI instance named `app` from this file."""
from app.main import app  # Vercel serves the FastAPI instance named "app"
from app.services.model_registry import registry

registry.ensure_loaded()  # load models at cold start even if the platform skips ASGI lifespan events
