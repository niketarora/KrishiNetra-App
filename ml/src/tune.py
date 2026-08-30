"""Time-series-aware hyperparameter search (ML1 doc sections 29-31).

A randomized search, scored on the chronological 2024 validation period rather
than on shuffled cross-validation folds. The best candidate per horizon is then
re-checked with walk-forward validation so a parameter set that only happens to
suit 2024 does not win.

    python -m src.tune --model hist_gbr --n-iter 25
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from src import config, evaluate, experiments, features, models, preprocessing, split, targets, train

SEARCH_SPACES: dict[str, dict[str, list]] = {
    "hist_gbr": {
        "max_iter": [300, 500, 800, 1200],
        "learning_rate": [0.02, 0.03, 0.05, 0.08, 0.12],
        "max_leaf_nodes": [15, 31, 63, 127],
        "min_samples_leaf": [10, 20, 40, 80],
        "l2_regularization": [0.0, 0.5, 1.0, 5.0],
        "max_features": [0.6, 0.8, 1.0],
    },
    "xgboost": {
        "n_estimators": [400, 800, 1200],
        "max_depth": [4, 6, 8, 10],
        "learning_rate": [0.02, 0.03, 0.05, 0.08],
        "subsample": [0.7, 0.8, 0.9, 1.0],
        "colsample_bytree": [0.6, 0.8, 1.0],
        "min_child_weight": [1, 5, 10, 20],
        "gamma": [0.0, 0.1, 0.5],
        "reg_alpha": [0.0, 0.1, 1.0],
        "reg_lambda": [0.5, 1.0, 5.0],
    },
    "lightgbm": {
        "n_estimators": [400, 800, 1200],
        "learning_rate": [0.02, 0.03, 0.05, 0.08],
        "num_leaves": [15, 31, 63, 127],
        "max_depth": [-1, 6, 10],
        "min_child_samples": [10, 20, 40, 80],
        "subsample": [0.7, 0.8, 0.9, 1.0],
        "colsample_bytree": [0.6, 0.8, 1.0],
        "reg_alpha": [0.0, 0.1, 1.0],
        "reg_lambda": [0.5, 1.0, 5.0],
    },
    "random_forest": {
        "n_estimators": [200, 400],
        "max_depth": [None, 12, 20],
        "min_samples_leaf": [1, 5, 10, 20],
        "max_features": [0.3, 0.5, 0.8],
    },
}


def sample_params(space: dict[str, list], rng: np.random.Generator) -> dict:
    return {key: choices[int(rng.integers(len(choices)))] for key, choices in space.items()}


def search(
    model_name: str,
    horizon: int,
    n_iter: int = 25,
    feature_set: str = "full",
    seed: int = config.RANDOM_STATE,
) -> dict:
    """Randomized search for one horizon. Returns the best candidate and trace."""
    bundle = preprocessing.load_bundle()
    df = bundle["data"]
    selected = features.select_feature_set(bundle["feature_columns"], feature_set)

    parts = split.chronological_split(df, horizon)
    target_col = targets.target_column(horizon)
    space = SEARCH_SPACES.get(model_name)
    if not space:
        raise ValueError(f"No search space defined for {model_name!r}")

    rng = np.random.default_rng(seed + horizon)
    trace = []
    best = None

    # Candidate 0 is always the package default, so tuning can only help.
    candidates = [{}] + [sample_params(space, rng) for _ in range(n_iter)]

    for i, params in enumerate(candidates):
        _, predictions, fit_seconds, _ = train.fit_predict(
            model_name, params, parts.train, {"valid": parts.valid}, selected, horizon
        )
        metrics = evaluate.all_metrics(parts.valid[target_col], predictions["valid"])
        record = {"iteration": i, "params": params, **metrics, "fit_seconds": round(fit_seconds, 1)}
        trace.append(record)

        if best is None or metrics["MAE"] < best["MAE"]:
            best = record
        print(
            f"    [{i:>3}/{len(candidates) - 1}] MAE={metrics['MAE']:8.3f} "
            f"best={best['MAE']:8.3f} ({fit_seconds:.1f}s)"
        )

    # Confirm the winner is stable across expanding-window folds, not just 2024.
    walk_forward = train.walk_forward_evaluate(
        model_name, best["params"], selected, horizon, df
    )

    experiments.log(
        f"exp_tune_{model_name}",
        model=model_name,
        horizon=horizon,
        split="valid",
        metrics={k: best[k] for k in ("n", "MAE", "RMSE", "MAPE", "sMAPE")},
        validation_period=f"{config.VALID_START}..{config.VALID_END}",
        n_features=len(selected),
        hyperparameters=best["params"],
        notes=(
            f"randomized search n_iter={n_iter}; "
            f"walk_forward_mean_MAE={walk_forward['mean_MAE']:.3f}"
        ),
    )

    return {
        "model": model_name,
        "horizon": horizon,
        "feature_set": feature_set,
        "best_params": best["params"],
        "best_validation": {k: best[k] for k in ("n", "MAE", "RMSE", "MAPE", "sMAPE")},
        "walk_forward": walk_forward,
        "trace": trace,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Tune ML Model 1 hyperparameters")
    parser.add_argument("--model", default="hist_gbr")
    parser.add_argument("--n-iter", type=int, default=25)
    parser.add_argument("--feature-set", default="full", choices=features.FEATURE_SETS)
    parser.add_argument("--horizons", default=",".join(str(h) for h in config.HORIZONS))
    args = parser.parse_args()

    horizons = tuple(int(h) for h in args.horizons.split(","))
    results = {}
    for horizon in horizons:
        print(f"\ntuning {args.model} for +{horizon}d ...")
        results[f"{horizon}d"] = search(
            args.model, horizon, args.n_iter, args.feature_set
        )

    tuned = {
        "model": args.model,
        "feature_set": args.feature_set,
        "tuned_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "n_iter": args.n_iter,
        "params": {k: v["best_params"] for k, v in results.items()},
        "validation_MAE": {k: v["best_validation"]["MAE"] for k, v in results.items()},
        "walk_forward_mean_MAE": {
            k: v["walk_forward"]["mean_MAE"] for k, v in results.items()
        },
    }
    with open(config.MODELS_DIR / "tuned_params.json", "w", encoding="utf-8") as fh:
        json.dump(tuned, fh, indent=2, default=str)
    with open(
        config.METRICS_DIR / f"tuning_trace_{args.model}.json", "w", encoding="utf-8"
    ) as fh:
        json.dump(results, fh, indent=2, default=str)

    print("\ntuned parameters written to", config.MODELS_DIR / "tuned_params.json")
    print(json.dumps(tuned["validation_MAE"], indent=2))


if __name__ == "__main__":
    main()
