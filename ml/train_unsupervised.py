"""Train Isolation Forest and K-Means on the UNLABELED training rows (no labels, so no SMOTE)."""
import joblib
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.metrics import silhouette_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

import config


def choose_k(X, ks=range(2, 11)):
    """Pick k by silhouette on the (unlabeled) scaled training data; no labels involved."""
    Z = StandardScaler().fit_transform(X)
    scores = {k: silhouette_score(Z, KMeans(k, n_init=10, random_state=config.SEED).fit_predict(Z)) for k in ks}
    return max(scores, key=scores.get)


def main():
    train = pd.read_csv(config.PROCESSED_DIR / "train.csv")
    X = pd.read_csv(config.PROCESSED_DIR / "train_unlabeled.csv")
    # contamination = anomaly rate observed in the labeled data (the only place it is known)
    contamination = float(min(max(train["label"].mean(), 0.005), 0.5))

    models = {
        "isolation_forest": IsolationForest(n_estimators=300, contamination=contamination, random_state=config.SEED),
        # anomaly = far from every centroid; the distance threshold is set in evaluate.py
        "kmeans": KMeans(n_clusters=choose_k(X), n_init=10, random_state=config.SEED),
    }
    config.ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    for name, model in models.items():
        pipe = Pipeline([("scaler", StandardScaler()), ("model", model)]).fit(X)
        joblib.dump(pipe, config.ARTIFACTS_DIR / f"{name}.joblib")
        extra = f"k={model.n_clusters}" if name == "kmeans" else f"contamination={contamination:.3f}"
        print(f"{name}: fitted ({extra})")


if __name__ == "__main__":
    main()
