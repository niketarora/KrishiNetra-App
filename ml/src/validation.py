"""Schema validation, data-quality reporting and leakage checks.

Covers ML1 doc sections 3 (quality), 7 (pipeline), 23 (frequency) and 45
(explicit leakage checks).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from src import config


class SchemaError(ValueError):
    """Raised when the raw dataset does not match the expected contract."""


def validate_schema(df: pd.DataFrame) -> None:
    """Fail loudly if required columns are absent or dates are unparseable."""
    missing = [c for c in config.EXPECTED_COLUMNS if c not in df.columns]
    if missing:
        raise SchemaError(f"Missing expected columns: {missing}")

    if df.empty:
        raise SchemaError("Dataset is empty")

    unparsed = int(df[config.DATE_COL].isna().sum())
    if unparsed:
        raise SchemaError(f"{unparsed} rows have an unparseable date")

    n_missing_target = int(df[config.PRICE_COL].isna().sum())
    if n_missing_target:
        raise SchemaError(
            f"{n_missing_target} rows have a missing modal_price; "
            "the target column must be complete"
        )


def quality_report(df: pd.DataFrame) -> dict:
    """Build the data-quality summary the doc asks for in sections 3 and 23."""
    group_sizes = df.groupby(config.GROUP_KEYS, observed=True).size()

    spans = (
        df.groupby(config.GROUP_KEYS, observed=True)[config.DATE_COL]
        .agg(["min", "max", "nunique"])
        .rename(columns={"nunique": "distinct_dates"})
    )
    spans["calendar_days"] = (spans["max"] - spans["min"]).dt.days + 1
    spans["missing_days"] = spans["calendar_days"] - spans["distinct_dates"]

    out_of_range = {}
    for col, (lo, hi) in config.VALUE_RANGES.items():
        if col in df.columns:
            series = pd.to_numeric(df[col], errors="coerce")
            bad = int(((series < lo) | (series > hi)).sum())
            if bad:
                out_of_range[col] = bad

    inconsistent_prices = int(
        (
            (df["min_price"] > df["max_price"])
            | (df[config.PRICE_COL] < df["min_price"])
            | (df[config.PRICE_COL] > df["max_price"])
        ).sum()
    )

    return {
        "rows": int(len(df)),
        "columns": int(df.shape[1]),
        "date_min": str(df[config.DATE_COL].min().date()),
        "date_max": str(df[config.DATE_COL].max().date()),
        "n_groups": int(len(group_sizes)),
        "obs_per_group": {
            "min": int(group_sizes.min()),
            "median": float(group_sizes.median()),
            "max": int(group_sizes.max()),
        },
        "groups_with_date_gaps": int((spans["missing_days"] > 0).sum()),
        "total_missing_calendar_days": int(spans["missing_days"].sum()),
        "is_strictly_daily": bool((spans["missing_days"] == 0).all()),
        "duplicate_key_rows": int(
            df.duplicated(config.GROUP_KEYS + [config.DATE_COL]).sum()
        ),
        "exact_duplicate_rows": int(df.duplicated().sum()),
        "missing_values": {k: int(v) for k, v in df.isna().sum().items() if v > 0},
        "out_of_range_values": out_of_range,
        "inconsistent_min_modal_max_rows": inconsistent_prices,
        "rows_per_year": {
            str(k): int(v)
            for k, v in df[config.DATE_COL].dt.year.value_counts().sort_index().items()
        },
        "constant_columns": sorted(
            c for c in df.columns if df[c].nunique(dropna=False) <= 1
        ),
        "categorical_cardinality": {
            c: int(df[c].nunique())
            for c in config.CATEGORICAL_COLUMNS
            if c in df.columns
        },
    }


def structural_leakage_checks(feature_cols: list[str], df: pd.DataFrame) -> dict:
    """Cheap structural assertions about the feature matrix.

    Not a proof of anything, but it catches the mistakes that actually happen:
    a target column left in the feature list, or a column named as a future
    observation slipping into the matrix.
    """
    findings: list[str] = []

    target_cols = {f"target_{h}d" for h in config.HORIZONS}
    bad_targets = sorted(target_cols.intersection(feature_cols))
    if bad_targets:
        findings.append(f"target columns present in feature list: {bad_targets}")

    bad_prefix = sorted(
        c for c in feature_cols if c.startswith(("future_", "forecast_", "lead_"))
    )
    if bad_prefix:
        findings.append(f"columns named as future information: {bad_prefix}")

    unknown = sorted(set(feature_cols) - set(df.columns))
    if unknown:
        findings.append(f"declared features absent from dataframe: {unknown}")

    return {"passed": not findings, "findings": findings}


def empirical_leakage_probe(
    df: pd.DataFrame, feature_cols: list[str], n_probe: int = 60
) -> dict:
    """Recompute features from truncated history and check nothing changes.

    For a sampled row at date ``t`` in a group, every feature is rebuilt using
    only that group's rows up to and including ``t``. A feature built with an
    unshifted forward-looking window produces a different value here, which is
    exactly the leakage the doc's section 45 asks us to rule out.
    """
    from src import features as features_module

    rng = np.random.default_rng(config.RANDOM_STATE)
    grouped = [g for _, g in df.groupby(config.GROUP_KEYS, observed=True)]

    mismatches: dict[str, int] = {}
    checked = 0

    for _ in range(n_probe):
        gdf = grouped[int(rng.integers(len(grouped)))]
        if len(gdf) <= config.MAX_LOOKBACK + 5:
            continue
        idx = int(rng.integers(config.MAX_LOOKBACK + 1, len(gdf)))

        truncated = features_module.build_features(gdf.iloc[: idx + 1].copy())
        original_row = gdf.iloc[idx]
        new_row = truncated.iloc[-1]
        checked += 1

        for col in feature_cols:
            if col not in truncated.columns:
                continue
            a, b = original_row.get(col), new_row.get(col)
            if pd.isna(a) and pd.isna(b):
                continue
            if pd.isna(a) or pd.isna(b) or not np.isclose(
                float(a), float(b), rtol=1e-6, atol=1e-6
            ):
                mismatches[col] = mismatches.get(col, 0) + 1

    return {
        "rows_probed": checked,
        "passed": not mismatches,
        "leaky_features": dict(sorted(mismatches.items(), key=lambda kv: -kv[1])),
    }


def save_report(report: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, default=str)
