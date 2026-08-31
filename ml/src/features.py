"""Time-series feature engineering (ML1 doc sections 10-21).

Every feature here is computed from values at or before the row's own date,
within its own ``mandi + variety + grade`` group. Nothing reads forward. The
targets live at t+1 / t+3 / t+7, so a window that includes the current row is
still strictly historical with respect to what is being predicted.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src import config

GROUP = config.GROUP_KEYS

# Features derived after the main concat, listed so a rebuild can clear them.
_DERIVED_COLUMNS = (
    "price_mean_7_vs_28",
    "price_mean_14_vs_28",
    "days_since_last_observation",
)


def _slope_weights(window: int) -> np.ndarray:
    """Least-squares slope weights for evenly spaced points 0..window-1."""
    x = np.arange(window, dtype=float)
    centered = x - x.mean()
    return centered / (centered**2).sum()


_SLOPE_WEIGHT_CACHE: dict[int, np.ndarray] = {}


def _rolling_slope(series: pd.Series, window: int) -> pd.Series:
    """Slope of a least-squares line fitted to the trailing ``window`` values."""
    if window not in _SLOPE_WEIGHT_CACHE:
        _SLOPE_WEIGHT_CACHE[window] = _slope_weights(window)
    weights = _SLOPE_WEIGHT_CACHE[window]
    return series.rolling(window, min_periods=window).apply(
        lambda values: float(np.dot(weights, values)), raw=True
    )


def _lag_features(g, column: str, lags, prefix: str) -> dict[str, pd.Series]:
    return {f"{prefix}_lag_{lag}": g[column].shift(lag) for lag in lags}


def _roll_mean_features(g, column: str, windows, prefix: str) -> dict[str, pd.Series]:
    return {
        f"{prefix}_roll_mean_{w}": g[column].transform(
            lambda s, w=w: s.rolling(w, min_periods=max(2, w // 2)).mean()
        )
        for w in windows
    }


def _roll_std_features(g, column: str, windows, prefix: str) -> dict[str, pd.Series]:
    return {
        f"{prefix}_roll_std_{w}": g[column].transform(
            lambda s, w=w: s.rolling(w, min_periods=max(2, w // 2)).std()
        )
        for w in windows
    }


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Return ``df`` with all engineered feature columns appended.

    ``df`` may contain one group or all of them; grouping is handled here. The
    frame must already be sorted by group and date.
    """
    df = df.sort_values(GROUP + [config.DATE_COL]).reset_index(drop=True)
    g = df.groupby(GROUP, observed=True)
    new: dict[str, pd.Series] = {}

    price = config.PRICE_COL

    # -- section 11: price lags ------------------------------------------
    new.update(_lag_features(g, price, config.PRICE_LAGS, "modal"))

    # -- section 12: price rolling statistics -----------------------------
    new.update(_roll_mean_features(g, price, config.PRICE_ROLL_WINDOWS, "price"))
    new.update(_roll_std_features(g, price, config.PRICE_ROLL_STD_WINDOWS, "price"))
    for w in config.PRICE_ROLL_MINMAX_WINDOWS:
        new[f"price_roll_min_{w}"] = g[price].transform(
            lambda s, w=w: s.rolling(w, min_periods=max(2, w // 2)).min()
        )
        new[f"price_roll_max_{w}"] = g[price].transform(
            lambda s, w=w: s.rolling(w, min_periods=max(2, w // 2)).max()
        )

    # -- section 13: momentum ---------------------------------------------
    for w in config.PRICE_CHANGE_WINDOWS:
        past = g[price].shift(w)
        new[f"price_change_{w}d"] = df[price] - past
        new[f"price_pct_change_{w}d"] = (df[price] / past.replace(0, np.nan)) - 1.0

    # -- section 14: min/max/modal relationships --------------------------
    new["price_range"] = df["max_price"] - df["min_price"]
    new["price_range_pct"] = new["price_range"] / df[price].replace(0, np.nan)
    new["modal_vs_min"] = df[price] - df["min_price"]
    new["max_vs_modal"] = df["max_price"] - df[price]
    new["modal_vs_max"] = df[price] / df["max_price"].replace(0, np.nan)

    # -- section 15: arrivals ---------------------------------------------
    new.update(_lag_features(g, "arrivals_tonnes", config.ARRIVALS_LAGS, "arrivals"))
    new.update(
        _roll_mean_features(
            g, "arrivals_tonnes", config.ARRIVALS_ROLL_MEAN_WINDOWS, "arrivals"
        )
    )
    new.update(
        _roll_std_features(
            g, "arrivals_tonnes", config.ARRIVALS_ROLL_STD_WINDOWS, "arrivals"
        )
    )
    arrivals_past_7 = g["arrivals_tonnes"].shift(7)
    new["arrivals_change_7d"] = df["arrivals_tonnes"] - arrivals_past_7
    new["arrivals_pct_change_7d"] = (
        df["arrivals_tonnes"] / arrivals_past_7.replace(0, np.nan)
    ) - 1.0

    # -- section 16: demand -----------------------------------------------
    new.update(_lag_features(g, "demand_score", config.DEMAND_LAGS, "demand"))
    new.update(
        _roll_mean_features(g, "demand_score", config.DEMAND_ROLL_MEAN_WINDOWS, "demand")
    )
    new.update(
        _roll_std_features(g, "demand_score", config.DEMAND_ROLL_STD_WINDOWS, "demand")
    )
    demand_past_7 = g["demand_score"].shift(7)
    new["demand_change_7d"] = df["demand_score"] - demand_past_7
    new["demand_pct_change_7d"] = (
        df["demand_score"] / demand_past_7.replace(0, np.nan)
    ) - 1.0

    # -- section 17: weather (observed only, never forecast) --------------
    for col, short in (
        ("temperature_c", "temperature"),
        ("rainfall_mm", "rainfall"),
        ("humidity_pct", "humidity"),
    ):
        new.update(_lag_features(g, col, config.WEATHER_LAGS, short))

    for w in config.WEATHER_ROLL_WINDOWS:
        new[f"temperature_roll_mean_{w}"] = g["temperature_c"].transform(
            lambda s, w=w: s.rolling(w, min_periods=max(2, w // 2)).mean()
        )
        new[f"humidity_roll_mean_{w}"] = g["humidity_pct"].transform(
            lambda s, w=w: s.rolling(w, min_periods=max(2, w // 2)).mean()
        )
        new[f"rainfall_roll_sum_{w}"] = g["rainfall_mm"].transform(
            lambda s, w=w: s.rolling(w, min_periods=max(2, w // 2)).sum()
        )

    # -- section 18: MSP relationship -------------------------------------
    msp = df["msp"].replace(0, np.nan)
    new["modal_minus_msp"] = df[price] - df["msp"]
    new["modal_vs_msp_pct"] = (df[price] / msp) - 1.0

    # -- section 19: cyclical seasonality ---------------------------------
    dates = df[config.DATE_COL]
    month = dates.dt.month
    dow = dates.dt.dayofweek
    doy = dates.dt.dayofyear
    days_in_year = np.where(dates.dt.is_leap_year, 366.0, 365.0)

    new["month_num"] = month
    new["month_sin"] = np.sin(2 * np.pi * month / 12.0)
    new["month_cos"] = np.cos(2 * np.pi * month / 12.0)
    new["dow_num"] = dow
    new["dow_sin"] = np.sin(2 * np.pi * dow / 7.0)
    new["dow_cos"] = np.cos(2 * np.pi * dow / 7.0)
    new["day_of_year"] = doy
    new["day_of_year_sin"] = np.sin(2 * np.pi * doy / days_in_year)
    new["day_of_year_cos"] = np.cos(2 * np.pi * doy / days_in_year)

    # -- section 20: trend -------------------------------------------------
    for w in config.PRICE_SLOPE_WINDOWS:
        new[f"price_slope_{w}d"] = g[price].transform(
            lambda s, w=w: _rolling_slope(s, w)
        )

    # Rebuilding on a frame that already carries features (the leakage probe
    # does exactly that) must replace those columns, not duplicate them.
    stale = [c for c in (*new, *_DERIVED_COLUMNS) if c in df.columns]
    features_df = pd.concat(
        [df.drop(columns=stale), pd.DataFrame(new, index=df.index)], axis=1
    )

    roll_7 = features_df["price_roll_mean_7"]
    roll_14 = features_df["price_roll_mean_14"]
    roll_28 = features_df["price_roll_mean_28"].replace(0, np.nan)
    features_df["price_mean_7_vs_28"] = (roll_7 / roll_28) - 1.0
    features_df["price_mean_14_vs_28"] = (roll_14 / roll_28) - 1.0

    # -- section 47: observation cadence ----------------------------------
    prev_date = features_df.groupby(GROUP, observed=True)[config.DATE_COL].shift(1)
    features_df["days_since_last_observation"] = (
        features_df[config.DATE_COL] - prev_date
    ).dt.days

    return features_df


def feature_columns(df: pd.DataFrame, drop_constant: bool = True) -> list[str]:
    """The model matrix: engineered features plus the usable raw predictors.

    Excludes identifiers, the raw date, every target, and (optionally) columns
    with no variation in the frame supplied — normally the training split, so
    the decision is made without looking at validation or test data.
    """
    excluded = set(
        config.GROUP_KEYS
        + config.CONSTANT_CANDIDATES
        + [config.DATE_COL, "day_of_week", "month"]
        + [f"target_{h}d" for h in config.HORIZONS]
    )

    cols = [
        c
        for c in df.columns
        if c not in excluded and pd.api.types.is_numeric_dtype(df[c])
    ]

    if drop_constant:
        cols = [c for c in cols if df[c].nunique(dropna=False) > 1]

    return cols


# Incremental feature sets for the experiment ladder in doc section 52. Each
# set is a superset of the one before it, so the accuracy gain from each family
# of features can be attributed.
_LAG_MARKERS = ("_lag_",)
_ROLL_MARKERS = ("_roll_",)
_DERIVED_MARKERS = (
    "_change_",
    "_pct_change_",
    "price_slope_",
    "price_mean_",
    "price_range",
    "modal_vs_",
    "max_vs_",
    "modal_minus_msp",
)

FEATURE_SETS = ("raw", "lags", "rolling", "full")


def select_feature_set(feature_cols: list[str], name: str) -> list[str]:
    """Narrow the full feature list down to one rung of the experiment ladder."""
    if name not in FEATURE_SETS:
        raise ValueError(f"Unknown feature set {name!r}; expected one of {FEATURE_SETS}")
    if name == "full":
        return list(feature_cols)

    def has(col: str, markers) -> bool:
        return any(m in col for m in markers)

    keep = []
    for col in feature_cols:
        is_lag = has(col, _LAG_MARKERS)
        is_roll = has(col, _ROLL_MARKERS)
        is_derived = has(col, _DERIVED_MARKERS)

        if name == "raw" and not (is_lag or is_roll or is_derived):
            keep.append(col)
        elif name == "lags" and not (is_roll or is_derived):
            keep.append(col)
        elif name == "rolling" and not is_derived:
            keep.append(col)
    return keep
