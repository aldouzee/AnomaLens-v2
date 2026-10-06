"""Evaluate every saved model on the untouched test set and write artifacts/metrics.json."""
import json
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (accuracy_score, average_precision_score, confusion_matrix,
                             f1_score, precision_score, recall_score, roc_auc_score)

import config
from common import anomaly_scores, decision, predict_labels


def main():
    meta = json.loads((config.PROCESSED_DIR / "meta.json").read_text())
    features = meta["features"]
    train = pd.read_csv(config.PROCESSED_DIR / "train.csv")
    test = pd.read_csv(config.PROCESSED_DIR / "test.csv")
    X_tr, X_te, y_te = train[features], test[features], test["label"].to_numpy()

    out = {}
    for name, (display, kind) in config.MODELS.items():
        path = config.ARTIFACTS_DIR / f"{name}.joblib"
        if not path.exists():
            print(f"skip {name}: {path.name} not found")
            continue
        pipe = joblib.load(path)
        # Unsupervised calibration comes from training data only.
        info = {}
        if kind == "unsupervised":
            if name == "kmeans":  # flag the farthest `anomaly_rate` share of training points
                dist = pipe.transform(X_tr).min(axis=1)
                info["threshold"] = float(np.quantile(dist, 1 - train["label"].mean()))
            info["score_scale"] = float(np.std(decision(pipe, X_tr, info))) or 1.0

        pred = predict_labels(pipe, kind, X_te, info)
        score = anomaly_scores(pipe, kind, X_te, info)
        tn, fp, fn, tp = confusion_matrix(y_te, pred, labels=[0, 1]).ravel()

        rows = X_te.head(50)  # per-record latency, as the API would call it
        t0 = time.perf_counter()
        for i in range(len(rows)):
            predict_labels(pipe, kind, rows.iloc[[i]], info)
        latency_ms = (time.perf_counter() - t0) / len(rows) * 1000

        out[name] = {
            "name": display, "type": kind, **info,
            "metrics": {
                "accuracy": accuracy_score(y_te, pred),
                "precision": precision_score(y_te, pred, zero_division=0),
                "recall": recall_score(y_te, pred, zero_division=0),
                "f1": f1_score(y_te, pred, zero_division=0),
                "roc_auc": roc_auc_score(y_te, score),
                "pr_auc": average_precision_score(y_te, score),
            },
            "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
            "latency_ms": latency_ms,
        }
        m = out[name]["metrics"]
        print(f"{display:22s} P={m['precision']:.2f} R={m['recall']:.2f} F1={m['f1']:.2f} "
              f"ROC={m['roc_auc']:.2f} PR={m['pr_auc']:.2f} {latency_ms:.1f}ms")

    (config.ARTIFACTS_DIR / "metrics.json").write_text(json.dumps({**meta, "models": out}, indent=2))
    print(f"wrote {config.ARTIFACTS_DIR / 'metrics.json'}")


if __name__ == "__main__":
    main()
