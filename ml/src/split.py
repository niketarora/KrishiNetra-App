"""Chronological splitting and walk-forward folds (ML1 doc sections 24, 25).

No shuffled splitting anywhere. Each split also applies an embargo: a row whose
target date falls inside a later period is dropped from the earlier one, so a
training row can never carry a price observed during validation or test.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from src import config, targets


@dataclass(frozen=True)
class Split:
    """One train/validation/test partition for a single horizon."""

    horizon: int
    train: pd.DataFrame
    valid: pd.DataFrame
    test: pd.DataFrame

    def summary(self) -> dict:
        def describe(frame: pd.DataFrame) -> dict:
            if frame.empty:
                return {"rows": 0}
            return {
                "rows": int(len(frame)),
                "from": str(frame[config.DATE_COL].min().date()),
                "to": str(frame[config.DATE_COL].max().date()),
            }

        return {
            "horizon_days": self.horizon,
            "train": describe(self.train),
            "valid": describe(self.valid),
            "test": describe(self.test),
        }


def _usable(df: pd.DataFrame, horizon: int) -> pd.DataFrame:
    """Rows that have a real target for this horizon."""
    return df[df[targets.target_column(horizon)].notna()]


def _window(
    df: pd.DataFrame,
    horizon: int,
    start: str | None,
    end: str | None,
    embargo: bool = True,
) -> pd.DataFrame:
    """Rows dated inside [start, end] whose target also lands inside the window.

    The second condition is the embargo. Without it, the last ``horizon`` days
    of a training period would be labelled with prices from the validation
    period.
    """
    dates = df[config.DATE_COL]
    mask = pd.Series(True, index=df.index)
    if start is not None:
        mask &= dates >= pd.Timestamp(start)
    if end is not None:
        mask &= dates <= pd.Timestamp(end)
        if embargo and config.USE_EMBARGO:
            mask &= dates + pd.Timedelta(days=horizon) <= pd.Timestamp(end)
    return df[mask]


def chronological_split(df: pd.DataFrame, horizon: int) -> Split:
    """The headline 2021-23 / 2024 / 2025 partition from doc section 24."""
    usable = _usable(df, horizon)
    return Split(
        horizon=horizon,
        train=_window(usable, horizon, None, config.TRAIN_END),
        valid=_window(usable, horizon, config.VALID_START, config.VALID_END),
        test=_window(usable, horizon, config.TEST_START, None, embargo=False),
    )


def walk_forward_folds(
    df: pd.DataFrame, horizon: int, n_folds: int = 3
) -> list[tuple[pd.DataFrame, pd.DataFrame]]:
    """Expanding-window folds over the pre-test period (doc section 25).

    Fold boundaries are derived from the actual date range rather than
    hard-coded, and the test period is never touched.
    """
    usable = _usable(df, horizon)
    pre_test = usable[usable[config.DATE_COL] < pd.Timestamp(config.TEST_START)]
    if pre_test.empty:
        return []

    years = sorted(pre_test[config.DATE_COL].dt.year.unique())
    if len(years) < 2:
        return []

    # Each fold validates on one year and trains on everything before it. The
    # earliest year is always training-only so the first fold has history.
    validation_years = years[1:][-n_folds:]

    folds: list[tuple[pd.DataFrame, pd.DataFrame]] = []
    for year in validation_years:
        train_end = f"{year - 1}-12-31"
        train = _window(pre_test, horizon, None, train_end)
        valid = _window(pre_test, horizon, f"{year}-01-01", f"{year}-12-31")
        if not train.empty and not valid.empty:
            folds.append((train, valid))
    return folds


def split_summary(df: pd.DataFrame) -> dict:
    """Row counts and date ranges for every horizon, for the run report."""
    out = {"splits": {}, "walk_forward": {}}
    for h in config.HORIZONS:
        split = chronological_split(df, h)
        out["splits"][f"{h}d"] = split.summary()
        out["walk_forward"][f"{h}d"] = [
            {
                "train_to": str(tr[config.DATE_COL].max().date()),
                "valid_from": str(va[config.DATE_COL].min().date()),
                "valid_to": str(va[config.DATE_COL].max().date()),
                "train_rows": int(len(tr)),
                "valid_rows": int(len(va)),
            }
            for tr, va in walk_forward_folds(df, h)
        ]
    return out
