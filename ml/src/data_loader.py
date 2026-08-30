"""Raw dataset loading. The raw CSV is read-only and never written back."""

from __future__ import annotations

import hashlib
from pathlib import Path

import pandas as pd

from src import config


def dataset_hash(path: Path = config.RAW_DATASET) -> str:
    """SHA-256 of the raw file, recorded in training metadata (doc section 44)."""
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_raw(path: Path = config.RAW_DATASET) -> pd.DataFrame:
    """Load the raw mandi CSV with dates parsed and nothing else altered."""
    if not path.exists():
        raise FileNotFoundError(f"Raw dataset not found at {path}")
    df = pd.read_csv(path)
    df[config.DATE_COL] = pd.to_datetime(df[config.DATE_COL], errors="coerce")
    return df


def load_processed(path: Path = config.PROCESSED_DATASET) -> pd.DataFrame:
    """Load the engineered feature table produced by the preprocessing step."""
    if not path.exists():
        raise FileNotFoundError(
            f"Processed dataset not found at {path}. "
            "Run `python -m src.preprocessing` first."
        )
    if path.suffix == ".parquet":
        return pd.read_parquet(path)
    return pd.read_csv(path, parse_dates=[config.DATE_COL])
