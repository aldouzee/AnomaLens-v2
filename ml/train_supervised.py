"""Train Random Forest, Bagging and SVM. Scaler + SMOTE + classifier live in one pipeline,
so SMOTE only runs during fit (never at predict time) and the scaler is fit on train only."""
import joblib
import pandas as pd
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline
from sklearn.ensemble import BaggingClassifier, GradientBoostingClassifier, RandomForestClassifier, StackingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

import config


def build(clf):
    return Pipeline([
        ("scaler", StandardScaler()),
        ("smote", SMOTE(random_state=config.SEED)),
        ("clf", clf),
    ])


def candidates():
    s = config.SEED
    return {
        "random_forest": (build(RandomForestClassifier(random_state=s)),
                          {"clf__n_estimators": [100, 200, 400], "clf__max_depth": [5, 10, None]}),
        "bagging": (build(BaggingClassifier(estimator=DecisionTreeClassifier(random_state=s), random_state=s)),
                    {"clf__n_estimators": [50, 100], "clf__max_samples": [0.7, 1.0], "clf__max_features": [0.7, 1.0]}),
        "boosting": (build(GradientBoostingClassifier(random_state=s)),
                     {"clf__n_estimators": [100, 200], "clf__learning_rate": [0.05, 0.1], "clf__max_depth": [2, 3]}),
        # Stacking: out-of-fold probabilities from three different learners feed a logistic-regression meta-model.
        # Fixed hyperparameters (the grid search would multiply an already nested cross-validation).
        "stacking": (build(StackingClassifier(
            estimators=[("rf", RandomForestClassifier(n_estimators=200, random_state=s)),
                        ("svm", SVC(kernel="rbf", probability=True, random_state=s)),
                        ("gb", GradientBoostingClassifier(random_state=s))],
            final_estimator=LogisticRegression(max_iter=1000), cv=5)), {}),
        "svm": (build(SVC(kernel="rbf", probability=True, random_state=s)),
                {"clf__C": [0.5, 1, 5, 10], "clf__gamma": ["scale", 0.1]}),
    }


def main():
    train = pd.read_csv(config.PROCESSED_DIR / "train.csv")
    X, y = train.drop(columns="label"), train["label"]
    config.ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    for name, (pipe, grid) in candidates().items():
        # SMOTE is inside the pipeline, so it is re-run per CV fold on the training part only.
        search = GridSearchCV(pipe, grid, cv=5, scoring="f1_macro", n_jobs=-1)
        search.fit(X, y)
        joblib.dump(search.best_estimator_, config.ARTIFACTS_DIR / f"{name}.joblib")
        print(f"{name}: cv f1_macro={search.best_score_:.3f} params={search.best_params_}")


if __name__ == "__main__":
    main()
