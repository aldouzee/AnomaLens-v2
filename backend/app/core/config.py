import os
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_ARTIFACTS = Path(__file__).resolve().parents[2] / "artifacts"   # backend/artifacts
BACKEND_DIR = Path(__file__).resolve().parents[2]  # backend/ (or /app in Docker)


def default_artifacts_dir() -> Path:
    """ARTIFACTS_DIR if set; else backend/artifacts (Vercel bundle); else ml/artifacts (local dev)."""
    env = os.getenv("ARTIFACTS_DIR")
    if env:
        return Path(env)
    bundled = BACKEND_DIR / "artifacts"
    return bundled if bundled.exists() else BACKEND_DIR.parent / "ml" / "artifacts"


@dataclass
class Settings:
    artifacts_dir: Path = field(default_factory=default_artifacts_dir)
    cors_origins: list[str] = field(
        default_factory=lambda: [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    )


settings = Settings()
