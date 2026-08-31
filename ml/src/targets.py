"""Direct multi-horizon target creation (ML1 doc sections 4 and 22).

One target column per horizon, so three independent models are trained rather
than feeding a +1 day prediction back in to reach +3 and +7.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src import config


def add_targets(df: pd.DataFrame, horizons=config.HORIZONS) -> pd.DataFrame:
    """Append ``target_{h}d`` columns holding the modal price at t+h.

    The horizon is interpreted as *calendar days*, not "h observations later".
    A target is only produced when the group actually has an observation
    exactly ``h`` days after the row's date; otherwise it stays NaN and the row
    is excluded from that horizon's training and evaluation. This makes the
    pipeline correct for gap-containing data even though the current dataset is
    strictly daily (doc sections 23 and 47).
    """
    df = df.sort_values(config.GROUP_KEYS + [config.DATE_COL]).reset_index(drop=True)
    g = df.groupby(config.GROUP_KEYS, observed=True)

    for h in horizons:
        future_price = g[config.PRICE_COL].shift(-h)
        future_date = g[config.DATE_COL].shift(-h)
        gap_matches = (future_date - df[config.DATE_COL]).dt.days == h
        df[f"target_{h}d"] = np.where(gap_matches, future_price, np.nan)

    return df


def target_column(horizon: int) -> str:
    return f"target_{horizon}d"


def target_coverage(df: pd.DataFrame, horizons=config.HORIZONS) -> dict:
    """How many rows have a usable target for each horizon."""
    return {
        f"{h}d": {
            "rows_with_target": int(df[target_column(h)].notna().sum()),
            "rows_without_target": int(df[target_column(h)].isna().sum()),
        }
        for h in horizons
    }
