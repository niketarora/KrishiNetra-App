"""Cleaning, historical-only imputation and the end-to-end dataset build.

Implements ML1 doc sections 7, 8, 9 and 21. Running this module as a script
produces the processed feature table plus the data-quality and leakage reports.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd

from src import config, data_loader, features, targets, validation

IMPUTED_COLUMNS = ["min_price", "max_price", "arrivals_tonnes"]
CATEGORICAL_ENCODE = ["mandi", "district", "variety", "grade"]


def coerce_numeric(df: pd.DataFrame) -> pd.DataFrame:
    """Force the numeric columns to real numbers; junk becomes NaN explicitly."""
    for col in config.NUMERIC_COLUMNS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Drop exact duplicates and sort chronologically within each group."""
    df = df.drop_duplicates()
    df = df.drop_duplicates(subset=config.GROUP_KEYS + [config.DATE_COL], keep="last")
    return df.sort_values(config.GROUP_KEYS + [config.DATE_COL]).reset_index(drop=True)


def fit_imputation_stats(train_df: pd.DataFrame) -> dict:
    """Fallback medians, fitted on the training period only (doc section 9)."""
    stats = {"global": {}, "per_group": {}}
    for col in IMPUTED_COLUMNS:
        stats["global"][col] = float(train_df[col].median())
        per_group = train_df.groupby(config.GROUP_KEYS, observed=True)[col].median()
        stats["per_group"][col] = {
            "|".join(map(str, key)): float(value)
            for key, value in per_group.dropna().items()
        }
    return stats


def apply_imputation(df: pd.DataFrame, stats: dict) -> pd.DataFrame:
    """Fill missing observations using only information available at that time.

    The cascade is: trailing 28-observation median within the group, then the
    group's expanding median over all prior observations, then the training-set
    median for that group, then the training-set global median. No step can see
    a value dated after the row being filled.
    """
    df = df.sort_values(config.GROUP_KEYS + [config.DATE_COL]).reset_index(drop=True)
    group_key = df[config.GROUP_KEYS].astype(str).agg("|".join, axis=1)

    for col in IMPUTED_COLUMNS:
        df[f"{col}_was_missing"] = df[col].isna().astype("int8")

        grouped = df.groupby(config.GROUP_KEYS, observed=True)[col]
        trailing = grouped.transform(
            lambda s: s.shift(1).rolling(28, min_periods=1).median()
        )
        expanding = grouped.transform(lambda s: s.shift(1).expanding().median())
        group_fallback = group_key.map(stats["per_group"][col])

        filled = (
            df[col]
            .fillna(trailing)
            .fillna(expanding)
            .fillna(group_fallback)
            .fillna(stats["global"][col])
        )
        df[col] = filled

    return df


def fit_category_maps(train_df: pd.DataFrame) -> dict[str, dict[str, int]]:
    """Stable integer codes for the categorical fields, learned from train only.

    Plain ordinal codes, not target encoding — target encoding fitted across the
    whole dataset is one of the leakage modes the doc calls out in section 45.
    """
    return {
        col: {str(v): i for i, v in enumerate(sorted(train_df[col].dropna().unique()))}
        for col in CATEGORICAL_ENCODE
        if col in train_df.columns
    }


def apply_category_maps(df: pd.DataFrame, maps: dict) -> pd.DataFrame:
    """Encode categoricals; anything unseen in training becomes -1."""
    for col, mapping in maps.items():
        df[f"{col}_code"] = (
            df[col].astype(str).map(mapping).fillna(-1).astype("int16")
        )
    return df


def build_dataset(save: bool = True, export_csv: bool = False) -> pd.DataFrame:
    """Run the full raw-to-features pipeline and write the reports."""
    print("[1/8] loading raw dataset ...")
    raw = data_loader.load_raw()

    print("[2/8] validating schema ...")
    validation.validate_schema(raw)

    print("[3/8] cleaning ...")
    df = clean(coerce_numeric(raw))

    print("[4/8] data quality report ...")
    quality = validation.quality_report(df)
    validation.save_report(quality, config.DATA_REPORTS_DIR / "data_quality.json")
    print(
        f"      {quality['rows']} rows, {quality['n_groups']} groups, "
        f"strictly daily = {quality['is_strictly_daily']}"
    )

    print("[5/8] historical-only imputation ...")
    train_mask = df[config.DATE_COL] <= pd.Timestamp(config.TRAIN_END)
    imputation_stats = fit_imputation_stats(df.loc[train_mask])
    df = apply_imputation(df, imputation_stats)

    category_maps = fit_category_maps(df.loc[train_mask])
    df = apply_category_maps(df, category_maps)

    print("[6/8] engineering features ...")
    df = features.build_features(df)

    print("[7/8] creating targets ...")
    df = targets.add_targets(df)
    coverage = targets.target_coverage(df)

    print("[8/8] leakage checks ...")
    train_only = df[df[config.DATE_COL] <= pd.Timestamp(config.TRAIN_END)]
    feature_cols = features.feature_columns(train_only)
    structural = validation.structural_leakage_checks(feature_cols, df)
    empirical = validation.empirical_leakage_probe(df, feature_cols)

    leakage_report = {
        "structural": structural,
        "empirical": empirical,
        "n_features": len(feature_cols),
    }
    validation.save_report(
        leakage_report, config.DATA_REPORTS_DIR / "leakage_checks.json"
    )
    status = "PASS" if structural["passed"] and empirical["passed"] else "FAIL"
    print(
        f"      structural={structural['passed']} empirical={empirical['passed']} "
        f"-> {status} ({len(feature_cols)} features)"
    )

    build_info = {
        "built_at": datetime.now(timezone.utc).isoformat(),
        "raw_dataset": str(config.RAW_DATASET),
        "raw_dataset_sha256": data_loader.dataset_hash(),
        "random_state": config.RANDOM_STATE,
        "rows": int(len(df)),
        "n_features": len(feature_cols),
        "feature_columns": feature_cols,
        "target_coverage": coverage,
        "imputation_stats_fitted_on": f"<= {config.TRAIN_END}",
        "category_maps": category_maps,
        "horizon_interpretation": "calendar days (t+h), target NaN when no observation exists exactly h days later",
    }

    if save:
        joblib.dump(
            {
                "data": df,
                "feature_columns": feature_cols,
                "imputation_stats": imputation_stats,
                "category_maps": category_maps,
                "build_info": build_info,
            },
            config.PROCESSED_DATASET,
            compress=3,
        )
        validation.save_report(
            build_info, config.DATA_REPORTS_DIR / "build_info.json"
        )
        if export_csv:
            df.to_csv(config.PROCESSED_DATASET_CSV, index=False)
        print(f"      saved -> {config.PROCESSED_DATASET}")

    return df


def load_bundle() -> dict:
    """Load the processed bundle written by ``build_dataset``."""
    if not config.PROCESSED_DATASET.exists():
        raise FileNotFoundError(
            f"{config.PROCESSED_DATASET} not found. Run `python -m src.preprocessing`."
        )
    return joblib.load(config.PROCESSED_DATASET)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Build the ML1 feature dataset")
    parser.add_argument("--csv", action="store_true", help="also export a CSV copy")
    args = parser.parse_args()

    frame = build_dataset(save=True, export_csv=args.csv)
    print(json.dumps({"rows": len(frame), "columns": frame.shape[1]}, indent=2))
