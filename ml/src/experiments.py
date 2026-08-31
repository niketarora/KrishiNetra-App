"""Experiment tracking (ML1 doc section 51).

Every run appends one row per horizon to ``reports/metrics/experiments.csv`` so
model selection is decided from a record rather than from memory.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pandas as pd

from src import config

EXPERIMENTS_CSV = config.METRICS_DIR / "experiments.csv"

COLUMNS = [
    "experiment_id",
    "recorded_at",
    "model",
    "horizon",
    "split",
    "n",
    "MAE",
    "RMSE",
    "MAPE",
    "sMAPE",
    "train_period",
    "validation_period",
    "test_period",
    "n_features",
    "hyperparameters",
    "notes",
]


def log(
    experiment_id: str,
    model: str,
    horizon: int,
    split: str,
    metrics: dict,
    *,
    train_period: str = "",
    validation_period: str = "",
    test_period: str = "",
    n_features: int | None = None,
    hyperparameters: dict | None = None,
    notes: str = "",
) -> None:
    """Append a single evaluated result to the experiment log."""
    row = {
        "experiment_id": experiment_id,
        "recorded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model": model,
        "horizon": f"{horizon}d",
        "split": split,
        "n": metrics.get("n"),
        "MAE": metrics.get("MAE"),
        "RMSE": metrics.get("RMSE"),
        "MAPE": metrics.get("MAPE"),
        "sMAPE": metrics.get("sMAPE"),
        "train_period": train_period,
        "validation_period": validation_period,
        "test_period": test_period,
        "n_features": n_features,
        "hyperparameters": json.dumps(hyperparameters or {}, sort_keys=True),
        "notes": notes,
    }

    frame = pd.DataFrame([row], columns=COLUMNS)
    header = not EXPERIMENTS_CSV.exists()
    frame.to_csv(EXPERIMENTS_CSV, mode="a", header=header, index=False)


def load() -> pd.DataFrame:
    if not EXPERIMENTS_CSV.exists():
        return pd.DataFrame(columns=COLUMNS)
    return pd.read_csv(EXPERIMENTS_CSV)


def leaderboard(split: str = "test") -> pd.DataFrame:
    """Best recorded MAE per model and horizon for one split."""
    frame = load()
    if frame.empty:
        return frame
    frame = frame[frame["split"] == split]
    return (
        frame.sort_values("MAE")
        .groupby(["horizon", "model"], as_index=False)
        .first()
        .sort_values(["horizon", "MAE"])
        .reset_index(drop=True)
    )
