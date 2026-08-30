"""Prediction intervals via quantile regression (ML1 doc section 48).

The doc is explicit that an arbitrary score must not be called "confidence"
unless its meaning is defined. So this module produces something with a stated
meaning and then measures whether the claim holds: a nominal 80% interval from
10th- and 90th-percentile models, reported alongside its *empirical coverage*
on the untouched test period — the share of actual prices that landed inside.

An interval whose measured coverage is far from nominal is reported as such
rather than quietly shipped.

    python -m src.intervals --model lightgbm
"""

from __future__ import annotations

import argparse
import json

import joblib
import numpy as np
import pandas as pd

from src import config, evaluate, features, models, preprocessing, split, targets, train

LOWER_Q, UPPER_Q = 0.1, 0.9


def quantile_params(model_name: str, quantile: float) -> dict:
    """Per-library spelling of "fit this quantile rather than the mean"."""
    if model_name == "lightgbm":
        return {"objective": "quantile", "alpha": quantile}
    if model_name == "xgboost":
        return {"objective": "reg:quantileerror", "quantile_alpha": quantile}
    if model_name == "hist_gbr":
        return {"loss": "quantile", "quantile": quantile}
    raise ValueError(f"{model_name!r} does not support quantile regression here")


def fit_intervals(
    model_name: str, horizon: int, feature_set: str = "full"
) -> dict:
    """Fit the two quantile models and measure coverage on the test period."""
    bundle = preprocessing.load_bundle()
    df = bundle["data"]
    selected = features.select_feature_set(bundle["feature_columns"], feature_set)

    parts = split.chronological_split(df, horizon)
    target_col = targets.target_column(horizon)
    fit_frame = pd.concat([parts.train, parts.valid]).sort_values(
        config.GROUP_KEYS + [config.DATE_COL]
    )

    bounds = {}
    fitted = {}
    for label, quantile in (("lower", LOWER_Q), ("upper", UPPER_Q)):
        model, predictions, _, medians = train.fit_predict(
            model_name,
            quantile_params(model_name, quantile),
            fit_frame,
            {"test": parts.test},
            selected,
            horizon,
        )
        bounds[label] = predictions["test"]
        fitted[label] = {"model": model, "impute_medians": medians}

    lower = np.minimum(bounds["lower"], bounds["upper"])
    upper = np.maximum(bounds["lower"], bounds["upper"])
    y_true = parts.test[target_col].to_numpy(dtype=float)

    inside = (y_true >= lower) & (y_true <= upper)
    width = upper - lower

    artifact = {
        "model_name": model_name,
        "horizon": horizon,
        "target_mode": config.TARGET_MODE,
        "feature_columns": selected,
        "quantiles": {"lower": LOWER_Q, "upper": UPPER_Q},
        "lower": fitted["lower"],
        "upper": fitted["upper"],
        "category_maps": bundle["category_maps"],
        "imputation_stats": bundle["imputation_stats"],
    }
    joblib.dump(
        artifact, config.MODELS_DIR / f"wheat_price_interval_{horizon}d.pkl", compress=3
    )

    return {
        "horizon": f"{horizon}d",
        "model": model_name,
        "nominal_coverage": round(UPPER_Q - LOWER_Q, 3),
        "empirical_coverage": round(float(inside.mean()), 4),
        "median_width_rupees": round(float(np.median(width)), 2),
        "mean_width_rupees": round(float(width.mean()), 2),
        "n": int(len(y_true)),
        "interpretation": (
            f"A nominal {int((UPPER_Q - LOWER_Q) * 100)}% interval. Empirical "
            f"coverage is the measured share of test-period prices that fell "
            f"inside it; treat the empirical number, not the nominal one, as "
            f"the honest description."
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fit prediction intervals")
    parser.add_argument("--model", default="lightgbm")
    parser.add_argument("--feature-set", default="full", choices=features.FEATURE_SETS)
    parser.add_argument("--horizons", default=",".join(str(h) for h in config.HORIZONS))
    args = parser.parse_args()

    if not models.is_available(args.model):
        raise SystemExit(f"{args.model!r} is not installed")

    results = {}
    for horizon in (int(h) for h in args.horizons.split(",")):
        result = fit_intervals(args.model, horizon, args.feature_set)
        results[result["horizon"]] = result
        print(
            f"  +{result['horizon']}  nominal={result['nominal_coverage']:.0%}  "
            f"empirical={result['empirical_coverage']:.1%}  "
            f"median width=Rs {result['median_width_rupees']}"
        )

    path = config.METRICS_DIR / "prediction_intervals.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2, default=str)
    print(f"\nwritten -> {path}")


if __name__ == "__main__":
    main()
