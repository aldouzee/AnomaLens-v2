"""Load, validate and split the raw data. Run: python preprocess.py

Supervised models train on the labeled file. Unsupervised models are fitted on the unlabeled
file, restricted to the same training rows, so no test record is ever seen during fitting.
Scaling and SMOTE happen inside the model pipelines (train data only).
"""
import json
import re

import pandas as pd
from sklearn.model_selection import train_test_split

import config


def _norm(col: str) -> str:
    return re.sub(r"[^0-9a-z]+", "_", str(col).strip().lower()).strip("_")


def _read(name: str) -> pd.DataFrame:
    path = config.RAW_DIR / name
    if not path.exists():
        raise SystemExit(f"Missing {path}")
    df = pd.read_csv(path)
    df.columns = [_norm(c) for c in df.columns]
    return df


def to_binary(s: pd.Series) -> pd.Series:
    if pd.api.types.is_numeric_dtype(s):
        return (s != 0).astype(int)
    return s.astype(str).str.strip().str.lower().isin(config.ANOMALY_VALUES).astype(int)


def load():
    labeled, unlabeled = _read(config.LABELED_FILE), _read(config.UNLABELED_FILE)
    label = _norm(config.LABEL_COLUMN)
    features = config.FEATURES
    for name, df in (("labeled", labeled), ("unlabeled", unlabeled)):
        missing = [f for f in features if f not in df.columns]
        if missing:
            raise SystemExit(f"{name} file is missing feature columns {missing}")
    if label not in labeled.columns:
        raise SystemExit(f"Label column '{label}' not in labeled file: {list(labeled.columns)}")
    if len(labeled) != len(unlabeled):
        raise SystemExit("Labeled and unlabeled files must have the same number of rows")

    X = labeled[features].apply(pd.to_numeric, errors="coerce")
    U = unlabeled[features].apply(pd.to_numeric, errors="coerce")
    if not X.equals(U):
        raise SystemExit("Feature values differ between labeled and unlabeled files; rows are not aligned")
    keep = X.notna().all(axis=1)  # drop rows with missing feature values
    return X[keep].reset_index(drop=True), U[keep].reset_index(drop=True), to_binary(labeled[label])[keep].reset_index(drop=True), features, label


def main():
    X, U, y, features, label = load()
    idx_tr, idx_te = train_test_split(X.index, test_size=config.TEST_SIZE, stratify=y, random_state=config.SEED)
    config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    config.ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    X.loc[idx_tr].assign(label=y[idx_tr].values).to_csv(config.PROCESSED_DIR / "train.csv", index=False)
    U.loc[idx_tr].to_csv(config.PROCESSED_DIR / "train_unlabeled.csv", index=False)  # no labels
    test = X.loc[idx_te].assign(label=y[idx_te].values)
    test.to_csv(config.PROCESSED_DIR / "test.csv", index=False)
    test.to_csv(config.ARTIFACTS_DIR / "stream_sample.csv", index=False)  # replayed by the live simulator

    meta = {
        "source": f"{config.LABELED_FILE} (supervised) + {config.UNLABELED_FILE} (unsupervised)",
        "label": label, "features": features,
        "rows": int(len(X)), "anomalies": int(y.sum()), "anomaly_rate": float(y.mean()),
        "train_rows": int(len(idx_tr)), "test_rows": int(len(idx_te)), "test_anomalies": int(y[idx_te].sum()),
    }
    (config.PROCESSED_DIR / "meta.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
