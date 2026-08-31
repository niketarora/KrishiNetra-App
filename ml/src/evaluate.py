"""Metrics and segmented evaluation (ML1 doc sections 33-36).

All metrics are implemented here rather than pulled from scikit-learn so the
evaluation stage has no dependency beyond pandas/numpy, and so the protected
MAPE denominator is explicit rather than assumed.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src import config


def mae(y_true, y_pred) -> float:
    return float(np.mean(np.abs(np.asarray(y_true) - np.asarray(y_pred))))


def rmse(y_true, y_pred) -> float:
    diff = np.asarray(y_true) - np.asarray(y_pred)
    return float(np.sqrt(np.mean(diff**2)))


def mape(y_true, y_pred, epsilon: float = 1.0) -> float:
    """Percentage error with a protected denominator (doc section 33).

    Mandi prices never approach zero in this dataset, but the guard keeps the
    metric defined if a future real-world extract contains a zero or a stray
    negative price.
    """
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    denom = np.maximum(np.abs(y_true), epsilon)
    return float(np.mean(np.abs(y_true - y_pred) / denom) * 100.0)


def smape(y_true, y_pred, epsilon: float = 1.0) -> float:
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    denom = np.maximum((np.abs(y_true) + np.abs(y_pred)) / 2.0, epsilon)
    return float(np.mean(np.abs(y_true - y_pred) / denom) * 100.0)


def all_metrics(y_true, y_pred) -> dict:
    """The four headline metrics the doc requires for every horizon."""
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    finite = np.isfinite(y_true) & np.isfinite(y_pred)
    y_true, y_pred = y_true[finite], y_pred[finite]

    if y_true.size == 0:
        return {"n": 0, "MAE": np.nan, "RMSE": np.nan, "MAPE": np.nan, "sMAPE": np.nan}

    return {
        "n": int(y_true.size),
        "MAE": round(mae(y_true, y_pred), 3),
        "RMSE": round(rmse(y_true, y_pred), 3),
        "MAPE": round(mape(y_true, y_pred), 4),
        "sMAPE": round(smape(y_true, y_pred), 4),
    }


def metrics_by(
    df: pd.DataFrame, y_true_col: str, y_pred_col: str, by: str | list[str]
) -> pd.DataFrame:
    """Break the metrics down by mandi, variety, grade, month, etc."""
    by_cols = [by] if isinstance(by, str) else list(by)
    rows = []
    for key, chunk in df.groupby(by_cols, observed=True):
        key_tuple = key if isinstance(key, tuple) else (key,)
        row = dict(zip(by_cols, key_tuple))
        row.update(all_metrics(chunk[y_true_col], chunk[y_pred_col]))
        rows.append(row)
    out = pd.DataFrame(rows).sort_values("MAE", ascending=False)
    return out.reset_index(drop=True)


def segmented_report(
    df: pd.DataFrame, y_true_col: str, y_pred_col: str
) -> dict[str, list[dict]]:
    """Per-mandi, per-variety, per-grade and per-month breakdowns."""
    frame = df.copy()
    frame["month_of_year"] = frame[config.DATE_COL].dt.month

    report: dict[str, list[dict]] = {"overall": [all_metrics(frame[y_true_col], frame[y_pred_col])]}
    for segment in ("mandi", "variety", "grade", "month_of_year"):
        if segment in frame.columns:
            report[f"by_{segment}"] = metrics_by(
                frame, y_true_col, y_pred_col, segment
            ).to_dict("records")
    return report


def comparison_table(results: dict[str, dict[int, dict]]) -> pd.DataFrame:
    """Flatten ``{model: {horizon: metrics}}`` into the doc's section 34 table."""
    rows = []
    for model_name, per_horizon in results.items():
        for horizon, metrics in sorted(per_horizon.items()):
            rows.append({"model": model_name, "horizon": f"{horizon}d", **metrics})
    table = pd.DataFrame(rows)
    if table.empty:
        return table
    table["_h"] = table["horizon"].str.rstrip("d").astype(int)
    return (
        table.sort_values(["_h", "MAE"]).drop(columns="_h").reset_index(drop=True)
    )
