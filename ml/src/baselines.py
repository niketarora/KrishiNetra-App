"""Naive and rolling baselines (ML1 doc section 26).

These set the bar the ML models have to clear. They need no training, so they
are evaluated directly on the validation and test periods.

    python -m src.baselines
"""

from __future__ import annotations

import json

import numpy as np
import pandas as pd

from src import config, evaluate, experiments, preprocessing, split, targets

EXPERIMENT_ID = "exp_001_baselines"


def predict_naive(df: pd.DataFrame, horizon: int) -> np.ndarray:
    """Tomorrow looks like today: the current modal price, carried forward."""
    return df[config.PRICE_COL].to_numpy(dtype=float)


def predict_rolling_mean_7(df: pd.DataFrame, horizon: int) -> np.ndarray:
    """Mean of the trailing seven modal prices."""
    return df["price_roll_mean_7"].to_numpy(dtype=float)


def predict_rolling_mean_28(df: pd.DataFrame, horizon: int) -> np.ndarray:
    """Mean of the trailing 28 modal prices — a slower, smoother reference."""
    return df["price_roll_mean_28"].to_numpy(dtype=float)


def predict_drift(df: pd.DataFrame, horizon: int) -> np.ndarray:
    """Current price extrapolated along the trailing 7-day linear trend.

    This is the rolling/seasonal reference of the doc's third baseline: it is
    the cheapest model that knows prices have direction, so beating it means
    the ML model has learned more than "prices are trending".
    """
    current = df[config.PRICE_COL].to_numpy(dtype=float)
    slope = df["price_slope_7d"].to_numpy(dtype=float)
    return current + np.nan_to_num(slope) * horizon


BASELINES = {
    "naive": predict_naive,
    "rolling_mean_7": predict_rolling_mean_7,
    "rolling_mean_28": predict_rolling_mean_28,
    "drift_7d": predict_drift,
}


def run(log_experiments: bool = True) -> pd.DataFrame:
    """Evaluate every baseline on every horizon, for validation and test."""
    bundle = preprocessing.load_bundle()
    df = bundle["data"]

    results: dict[str, dict[int, dict]] = {}
    detail: dict[str, dict] = {}

    for horizon in config.HORIZONS:
        parts = split.chronological_split(df, horizon)
        summary = parts.summary()
        target_col = targets.target_column(horizon)

        for name, predictor in BASELINES.items():
            for split_name, frame in (("valid", parts.valid), ("test", parts.test)):
                if frame.empty:
                    continue
                predictions = predictor(frame, horizon)
                metrics = evaluate.all_metrics(frame[target_col], predictions)

                if split_name == "test":
                    results.setdefault(name, {})[horizon] = metrics
                    scored = frame.copy()
                    scored["y_pred"] = predictions
                    detail.setdefault(name, {})[f"{horizon}d"] = (
                        evaluate.segmented_report(scored, target_col, "y_pred")
                    )

                if log_experiments:
                    experiments.log(
                        EXPERIMENT_ID,
                        model=name,
                        horizon=horizon,
                        split=split_name,
                        metrics=metrics,
                        train_period=f"{summary['train'].get('from')}..{summary['train'].get('to')}",
                        validation_period=f"{summary['valid'].get('from')}..{summary['valid'].get('to')}",
                        test_period=f"{summary['test'].get('from')}..{summary['test'].get('to')}",
                        n_features=0,
                        notes="no training required",
                    )

    table = evaluate.comparison_table(results)

    with open(config.METRICS_DIR / "baselines_test.json", "w", encoding="utf-8") as fh:
        json.dump(detail, fh, indent=2, default=str)
    table.to_csv(config.METRICS_DIR / "baselines_test.csv", index=False)

    return table


if __name__ == "__main__":
    bundle_summary = split.split_summary(preprocessing.load_bundle()["data"])
    with open(config.METRICS_DIR / "splits.json", "w", encoding="utf-8") as fh:
        json.dump(bundle_summary, fh, indent=2, default=str)

    print(json.dumps(bundle_summary["splits"], indent=2))
    print("\nBaseline results on the untouched 2025 test period:\n")
    print(run().to_string(index=False))
