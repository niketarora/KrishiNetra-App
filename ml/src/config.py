"""Central configuration for ML Model 1 — wheat mandi price prediction.

Every path, split boundary and feature-window used by the pipeline is declared
here so experiments are reproducible (ML1 doc section 44).
"""

from __future__ import annotations

from pathlib import Path

# ---------------------------------------------------------------- paths -----
ML_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = ML_DIR.parent

RAW_DATASET = ML_DIR / "datasets" / "krishinetra_mandi_rajasthan.csv"

DATA_DIR = ML_DIR / "data"
PROCESSED_DIR = DATA_DIR / "processed"
DATA_REPORTS_DIR = DATA_DIR / "reports"

MODELS_DIR = ML_DIR / "models"

REPORTS_DIR = ML_DIR / "reports"
METRICS_DIR = REPORTS_DIR / "metrics"
PLOTS_DIR = REPORTS_DIR / "plots"
IMPORTANCE_DIR = REPORTS_DIR / "feature_importance"

PROCESSED_DATASET = PROCESSED_DIR / "wheat_features.pkl"
PROCESSED_DATASET_CSV = PROCESSED_DIR / "wheat_features.csv"

for _d in (
    PROCESSED_DIR,
    DATA_REPORTS_DIR,
    MODELS_DIR,
    METRICS_DIR,
    PLOTS_DIR,
    IMPORTANCE_DIR,
):
    _d.mkdir(parents=True, exist_ok=True)

# ------------------------------------------------------------ experiment ----
RANDOM_STATE = 42

# Forecast horizons in days (ML1 doc section 4) — direct multi-horizon.
HORIZONS = (1, 3, 7)

# What the regressor actually learns.
#   "level" — the raw future price.
#   "delta" — the change from today's modal price; the prediction is then
#             current_price + predicted_change.
# Trees cannot extrapolate beyond the price levels they saw in training, and
# mandi price levels drift year on year, so "level" makes the model lose to the
# naive baseline. Learning the change removes that drift from the target.
TARGET_MODE = "delta"

# The forecasting entity (ML1 doc section 6).
GROUP_KEYS = ["mandi", "variety", "grade"]

DATE_COL = "date"
PRICE_COL = "modal_price"

# ----------------------------------------------------------------- schema ---
EXPECTED_COLUMNS = [
    "date",
    "state",
    "district",
    "mandi",
    "crop",
    "variety",
    "grade",
    "min_price",
    "max_price",
    "modal_price",
    "arrivals_tonnes",
    "temperature_c",
    "rainfall_mm",
    "humidity_pct",
    "demand_score",
    "msp",
    "month",
    "day_of_week",
]

NUMERIC_COLUMNS = [
    "min_price",
    "max_price",
    "modal_price",
    "arrivals_tonnes",
    "temperature_c",
    "rainfall_mm",
    "humidity_pct",
    "demand_score",
    "msp",
    "month",
]

CATEGORICAL_COLUMNS = ["mandi", "district", "variety", "grade"]

# Columns that are constant in the current Rajasthan/Wheat extract and are
# therefore dropped from the model matrix (ML1 doc section 21).
CONSTANT_CANDIDATES = ["state", "crop"]

# Plausible ranges used by the quality report to flag nonsense values.
VALUE_RANGES = {
    "min_price": (0, 20000),
    "max_price": (0, 20000),
    "modal_price": (0, 20000),
    "arrivals_tonnes": (0, 100000),
    "temperature_c": (-10, 60),
    "rainfall_mm": (0, 1000),
    "humidity_pct": (0, 100),
    "demand_score": (0, 1000),
    "msp": (0, 20000),
}

# ------------------------------------------------------------ split dates ---
# Chronological split (ML1 doc section 24). The test period is never used for
# any model-selection decision.
TRAIN_END = "2023-12-31"
VALID_START, VALID_END = "2024-01-01", "2024-12-31"
TEST_START = "2025-01-01"

# Rows within `horizon` days of a split boundary have targets that fall inside
# the next period. They are dropped from the earlier period so no training row
# can peek at a validation/test-period price.
USE_EMBARGO = True

# ------------------------------------------------------- feature windows ----
PRICE_LAGS = (1, 2, 3, 4, 5, 7, 14, 21, 28)
PRICE_ROLL_WINDOWS = (3, 7, 14, 21, 28)
PRICE_ROLL_STD_WINDOWS = (7, 14, 28)
PRICE_ROLL_MINMAX_WINDOWS = (7, 28)
PRICE_CHANGE_WINDOWS = (1, 3, 7, 14)
PRICE_SLOPE_WINDOWS = (7, 14, 28)

ARRIVALS_LAGS = (1, 3, 7, 14, 28)
ARRIVALS_ROLL_MEAN_WINDOWS = (7, 14, 28)
ARRIVALS_ROLL_STD_WINDOWS = (7, 28)

DEMAND_LAGS = (1, 3, 7, 14, 28)
DEMAND_ROLL_MEAN_WINDOWS = (7, 14, 28)
DEMAND_ROLL_STD_WINDOWS = (7, 28)

WEATHER_LAGS = (1, 3, 7)
WEATHER_ROLL_WINDOWS = (7, 14)

# Longest look-back used by any feature. Rows before this many observations
# into a group have partially-undefined history.
MAX_LOOKBACK = 28
