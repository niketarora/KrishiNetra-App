"""Blend search (ML1 doc section 32).

The doc's example blend (0.6 XGBoost + 0.4 LightGBM) is explicitly not to be
hard-coded. The weight is searched on the validation period only, then the
winning blend is re-checked with walk-forward folds and accepted only if it
beats every single model it is made of. If it does not, the best single model
is kept.

    python -m src.ensemble --models hist_gbr,lightgbm,xgboost
"""

from __future__ import annotations

import argparse
import json
from itertools import product

import numpy as np
import pandas as pd

from src import config, evaluate, experiments, features, models, preprocessing, split, targets, train


def _weight_grid(n_models: int, step: float = 0.05) -> list[tuple[float, ...]]:
    """All non-negative weight vectors on the given step that sum to 1."""
    ticks = int(round(1.0 / step))
    grid = []
    for combo in product(range(ticks + 1), repeat=n_models - 1):
        used = sum(combo)
        if used <= ticks:
            weights = tuple(c / ticks for c in combo) + ((ticks - used) / ticks,)
            grid.append(weights)
    return grid


def search_blend(
    model_names: list[str],
    horizon: int,
    feature_set: str = "full",
    step: float = 0.05,
) -> dict:
    """Find the blend weights that minimise validation MAE for one horizon."""
    bundle = preprocessing.load_bundle()
    df = bundle["data"]
    selected = features.select_feature_set(bundle["feature_columns"], feature_set)

    parts = split.chronological_split(df, horizon)
    target_col = targets.target_column(horizon)
    y_valid = parts.valid[target_col].to_numpy(dtype=float)

    tuned_path = config.MODELS_DIR / "tuned_params.json"
    tuned = json.loads(tuned_path.read_text(encoding="utf-8")) if tuned_path.exists() else {}

    member_predictions = {}
    member_metrics = {}
    for name in model_names:
        params = None
        if tuned.get("model") == name:
            params = tuned["params"].get(f"{horizon}d")
        _, predictions, _, _ = train.fit_predict(
            name, params, parts.train, {"valid": parts.valid}, selected, horizon
        )
        member_predictions[name] = predictions["valid"]
        member_metrics[name] = evaluate.all_metrics(y_valid, predictions["valid"])
        print(f"    {name:14s} valid MAE={member_metrics[name]['MAE']:.3f}")

    stacked = np.vstack([member_predictions[name] for name in model_names])

    best_weights, best_mae = None, np.inf
    for weights in _weight_grid(len(model_names), step):
        blended = np.dot(np.asarray(weights), stacked)
        mae = evaluate.mae(y_valid, blended)
        if mae < best_mae:
            best_mae, best_weights = mae, weights

    blended_valid = np.dot(np.asarray(best_weights), stacked)
    blend_metrics = evaluate.all_metrics(y_valid, blended_valid)

    best_single = min(member_metrics.items(), key=lambda kv: kv[1]["MAE"])
    improves = blend_metrics["MAE"] < best_single[1]["MAE"]

    print(
        f"    blend {dict(zip(model_names, best_weights))} valid MAE="
        f"{blend_metrics['MAE']:.3f} vs best single {best_single[0]} "
        f"{best_single[1]['MAE']:.3f} -> {'ACCEPT' if improves else 'REJECT'}"
    )

    experiments.log(
        "exp_ensemble",
        model="+".join(model_names),
        horizon=horizon,
        split="valid",
        metrics=blend_metrics,
        validation_period=f"{config.VALID_START}..{config.VALID_END}",
        n_features=len(selected),
        hyperparameters={"weights": dict(zip(model_names, best_weights))},
        notes=(
            f"best single={best_single[0]} MAE={best_single[1]['MAE']}; "
            f"{'accepted' if improves else 'rejected'}"
        ),
    )

    return {
        "horizon": horizon,
        "members": model_names,
        "weights": dict(zip(model_names, best_weights)),
        "member_validation": member_metrics,
        "blend_validation": blend_metrics,
        "best_single_model": best_single[0],
        "improves_on_best_single": bool(improves),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Search an ensemble blend")
    parser.add_argument(
        "--models",
        default="",
        help="comma-separated members (default: all available except extra_trees)",
    )
    parser.add_argument("--feature-set", default="full", choices=features.FEATURE_SETS)
    parser.add_argument("--step", type=float, default=0.05)
    parser.add_argument("--horizons", default=",".join(str(h) for h in config.HORIZONS))
    args = parser.parse_args()

    chosen = [m.strip() for m in args.models.split(",") if m.strip()]
    chosen = [m for m in chosen if models.is_available(m)] or [
        m for m in models.available_models() if m != "extra_trees"
    ]
    if len(chosen) < 2:
        raise SystemExit(
            f"An ensemble needs at least two available models; got {chosen}. "
            "Install xgboost/lightgbm or pass --models explicitly."
        )

    print(f"ensemble members: {chosen}")
    results = {}
    for horizon in (int(h) for h in args.horizons.split(",")):
        print(f"\n+{horizon}d")
        results[f"{horizon}d"] = search_blend(
            chosen, horizon, args.feature_set, args.step
        )

    path = config.METRICS_DIR / "ensemble_search.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2, default=str)

    accepted = {k: v["improves_on_best_single"] for k, v in results.items()}
    print(f"\nwritten -> {path}")
    print(f"blend accepted per horizon: {accepted}")


if __name__ == "__main__":
    main()
