"""Feature importance and explanation (ML1 doc section 38).

Native importances where the estimator exposes them, permutation importance on
the test period as a model-agnostic cross-check, and SHAP if it is installed.

Importance is not causation: a high score means the model leaned on that column,
not that the column moves the price.

    python -m src.explain --model hist_gbr
"""

from __future__ import annotations

import argparse
import json

import joblib
import numpy as np
import pandas as pd

from src import config, evaluate, models, preprocessing, split, targets, train


def load_artifact(horizon: int) -> dict:
    path = config.MODELS_DIR / f"wheat_price_{horizon}d.pkl"
    if not path.exists():
        raise FileNotFoundError(
            f"{path} not found. Run `python -m src.train --stage final` first."
        )
    return joblib.load(path)


def permutation_importance(
    artifact: dict, test_df: pd.DataFrame, horizon: int, n_repeats: int = 3, top_k: int = 30
) -> dict[str, float]:
    """Increase in test MAE when each column is shuffled.

    Model-agnostic, and it answers the question that matters: how much does the
    model's accuracy actually depend on this column?
    """
    feature_cols = artifact["feature_columns"]
    target_col = targets.target_column(horizon)
    y_true = test_df[target_col].to_numpy(dtype=float)
    current = test_df[config.PRICE_COL].to_numpy(dtype=float)
    medians = artifact.get("impute_medians")
    is_delta = artifact.get("target_mode") == "delta"

    base_matrix = test_df[feature_cols].to_numpy(dtype=float)
    if medians is not None:
        base_matrix = train.apply_impute(base_matrix, medians)

    def score(matrix: np.ndarray) -> float:
        predicted = artifact["model"].predict(matrix)
        if is_delta:
            predicted = predicted + current
        return evaluate.mae(y_true, predicted)

    baseline = score(base_matrix)
    rng = np.random.default_rng(config.RANDOM_STATE)

    deltas: dict[str, float] = {}
    for i, name in enumerate(feature_cols):
        scores = []
        for _ in range(n_repeats):
            shuffled = base_matrix.copy()
            shuffled[:, i] = rng.permutation(shuffled[:, i])
            scores.append(score(shuffled))
        deltas[name] = round(float(np.mean(scores) - baseline), 4)

    ranked = dict(sorted(deltas.items(), key=lambda kv: -kv[1])[:top_k])
    return {"baseline_MAE": round(baseline, 4), "mae_increase_when_shuffled": ranked}


def shap_summary(artifact: dict, test_df: pd.DataFrame, sample: int = 2000) -> dict | None:
    """Mean absolute SHAP value per feature, if the shap package is installed."""
    try:
        import shap
    except ImportError:
        return None

    feature_cols = artifact["feature_columns"]
    frame = test_df.sample(
        min(sample, len(test_df)), random_state=config.RANDOM_STATE
    )
    matrix = frame[feature_cols].to_numpy(dtype=float)
    medians = artifact.get("impute_medians")
    if medians is not None:
        matrix = train.apply_impute(matrix, medians)

    explainer = shap.Explainer(artifact["model"])
    values = explainer(matrix).values
    mean_abs = np.abs(values).mean(axis=0)
    ranked = sorted(
        ((name, float(score)) for name, score in zip(feature_cols, mean_abs)),
        key=lambda kv: -kv[1],
    )
    return {"n_sampled": int(len(frame)), "mean_abs_shap": dict(ranked[:30])}


def run(model_name: str, permutation: bool = True) -> dict:
    bundle = preprocessing.load_bundle()
    df = bundle["data"]

    report: dict = {"model": model_name, "note": "importance is association, not causation"}

    for horizon in config.HORIZONS:
        artifact = load_artifact(horizon)
        test_df = split.chronological_split(df, horizon).test

        entry: dict = {}
        native = models.feature_importance(artifact["model"], artifact["feature_columns"])
        if native:
            entry["native_importance_top30"] = dict(list(native.items())[:30])

        if permutation:
            entry["permutation_importance"] = permutation_importance(
                artifact, test_df, horizon
            )

        shap_entry = shap_summary(artifact, test_df)
        if shap_entry:
            entry["shap"] = shap_entry
        else:
            entry["shap"] = "shap not installed; skipped"

        report[f"{horizon}d"] = entry
        print(f"  +{horizon}d explanation done")

    path = config.IMPORTANCE_DIR / f"explanation_{model_name}.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, default=str)
    print(f"\nwritten -> {path}")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Explain ML Model 1")
    parser.add_argument("--model", default="hist_gbr")
    parser.add_argument(
        "--no-permutation",
        action="store_true",
        help="skip permutation importance (much faster)",
    )
    args = parser.parse_args()

    report = run(args.model, permutation=not args.no_permutation)
    for horizon in config.HORIZONS:
        entry = report[f"{horizon}d"]
        if "permutation_importance" in entry:
            top = entry["permutation_importance"]["mae_increase_when_shuffled"]
            print(f"\n+{horizon}d — top features by MAE increase when shuffled:")
            for name, value in list(top.items())[:10]:
                print(f"  {name:32s} {value:+.4f}")


if __name__ == "__main__":
    main()
