"""Standalone inference (ML1 doc section 49).

Deliberately self-contained: it reads the raw CSV and the saved model
artifacts, and has no connection to the Node backend, Supabase or the mobile
app (doc section 50).

    python -m src.predict --date 2025-01-15 --mandi Alwar --variety Dara --grade Average
"""

from __future__ import annotations

import argparse
import json

import joblib
import numpy as np
import pandas as pd

from src import config, data_loader, features, preprocessing


def load_artifacts(horizons=config.HORIZONS) -> dict[int, dict]:
    """Load the per-horizon model artifacts written by ``train.train_final``."""
    artifacts = {}
    for horizon in horizons:
        path = config.MODELS_DIR / f"wheat_price_{horizon}d.pkl"
        if not path.exists():
            raise FileNotFoundError(
                f"{path} not found. Run `python -m src.train --stage final` first."
            )
        artifacts[horizon] = joblib.load(path)
    return artifacts


def prepare_history(artifact: dict) -> pd.DataFrame:
    """Rebuild the feature table from the raw CSV using the saved fit statistics.

    The imputation medians and category codes come from the artifact, not from
    the data being scored, so inference reproduces exactly what training saw.
    """
    raw = preprocessing.clean(preprocessing.coerce_numeric(data_loader.load_raw()))
    imputed = preprocessing.apply_imputation(raw, artifact["imputation_stats"])
    encoded = preprocessing.apply_category_maps(imputed, artifact["category_maps"])
    return features.build_features(encoded)


def predict_one(
    frame: pd.DataFrame,
    artifact: dict,
    date: str,
    mandi: str,
    variety: str,
    grade: str,
) -> float:
    """Predict a single horizon for one mandi/variety/grade on one date."""
    row = frame[
        (frame["mandi"] == mandi)
        & (frame["variety"] == variety)
        & (frame["grade"] == grade)
        & (frame[config.DATE_COL] == pd.Timestamp(date))
    ]
    if row.empty:
        raise LookupError(
            f"No observation for {mandi} / {variety} / {grade} on {date}. "
            "Prediction requires a market observation on the prediction date."
        )

    matrix = row[artifact["feature_columns"]].to_numpy(dtype=float)
    medians = artifact.get("impute_medians")
    if medians is not None:
        matrix = np.where(np.isnan(matrix), medians, matrix)
        matrix = np.nan_to_num(matrix, nan=0.0, posinf=0.0, neginf=0.0)

    predicted = float(artifact["model"].predict(matrix)[0])
    if artifact.get("target_mode") == "delta":
        predicted += float(row[config.PRICE_COL].iloc[0])
    return predicted


def predict(date: str, mandi: str, variety: str, grade: str) -> dict:
    """Produce the +1 / +3 / +7 day forecast payload."""
    artifacts = load_artifacts()
    frame = prepare_history(next(iter(artifacts.values())))

    current = frame[
        (frame["mandi"] == mandi)
        & (frame["variety"] == variety)
        & (frame["grade"] == grade)
        & (frame[config.DATE_COL] == pd.Timestamp(date))
    ]
    if current.empty:
        raise LookupError(f"No observation for {mandi} / {variety} / {grade} on {date}")

    predictions = {
        f"{horizon}d": round(
            predict_one(frame, artifact, date, mandi, variety, grade), 2
        )
        for horizon, artifact in artifacts.items()
    }

    return {
        "crop": "Wheat",
        "state": str(current["state"].iloc[0]),
        "district": str(current["district"].iloc[0]),
        "mandi": mandi,
        "variety": variety,
        "grade": grade,
        "as_of_date": date,
        "current_modal_price": round(float(current[config.PRICE_COL].iloc[0]), 2),
        "prediction": predictions,
        "disclaimer": (
            "Trained on a synthetic Rajasthan wheat dataset. Not validated "
            "against real-world mandi outcomes."
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Wheat mandi price prediction")
    parser.add_argument("--date", required=True, help="prediction date, YYYY-MM-DD")
    parser.add_argument("--mandi", required=True)
    parser.add_argument("--variety", required=True)
    parser.add_argument("--grade", required=True)
    args = parser.parse_args()

    print(json.dumps(predict(args.date, args.mandi, args.variety, args.grade), indent=2))


if __name__ == "__main__":
    main()
