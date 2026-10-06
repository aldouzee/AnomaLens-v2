"""Copy the trained artifacts into backend/artifacts so they ship with a backend-only deployment (e.g. Vercel).
Run after evaluate.py. Only models listed in metrics.json are copied, so stale files (e.g. lof.joblib) are left out.
"""
import json
import shutil

import config

DEST = config.ROOT / "backend" / "artifacts"


def main():
    metrics = config.ARTIFACTS_DIR / "metrics.json"
    if not metrics.exists():
        raise SystemExit(f"{metrics} not found; run evaluate.py first")
    models = json.loads(metrics.read_text())["models"]
    files = [config.ARTIFACTS_DIR / f"{m}.joblib" for m in models] + [metrics, config.ARTIFACTS_DIR / "stream_sample.csv"]
    missing = [f.name for f in files if not f.exists()]
    if missing:
        raise SystemExit(f"Missing artifacts: {missing}")

    DEST.mkdir(parents=True, exist_ok=True)
    wanted = {f.name for f in files}
    for old in DEST.iterdir():  # drop files that are no longer part of the model set
        if old.is_file() and old.name not in wanted and old.suffix in {".joblib", ".json", ".csv"}:
            old.unlink()
            print(f"removed stale {old.name}")
    for f in files:
        shutil.copy2(f, DEST / f.name)
    total = sum(f.stat().st_size for f in DEST.iterdir() if f.is_file())
    print(f"copied {len(files)} files to {DEST} ({total / 1e6:.1f} MB; Vercel function limit is 500 MB incl. libraries)")


if __name__ == "__main__":
    main()
