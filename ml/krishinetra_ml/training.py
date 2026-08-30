"""XGBoost training pipeline for aligned soil-probe observations."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any

from .features import FEATURE_NAMES, SoilMoistureFeatures, validate_target
from .soil_moisture import SoilMoistureModel


class TrainingDataError(ValueError):
    """Raised when a training CSV is too small or violates the data contract."""


@dataclass(frozen=True, slots=True)
class TrainingConfig:
    test_size: float = 0.2
    random_state: int = 42
    minimum_rows: int = 30
    target_mae_percent: float = 10.0
    n_estimators: int = 500
    max_depth: int = 4
    learning_rate: float = 0.04


def train_from_csv(
    csv_path: str | Path,
    model_path: str | Path,
    *,
    model_version: str | None = None,
    config: TrainingConfig | None = None,
) -> dict[str, Any]:
    """Train, evaluate, and save a model with reproducibility metadata.

    If ``farm_id`` is available, the validation split is farm-grouped to avoid
    leaking observations from the same field into train and test sets.
    """

    try:
        import numpy as np
        import pandas as pd
        import xgboost as xgb
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
        from sklearn.model_selection import GroupShuffleSplit, train_test_split
    except ImportError as exc:
        raise RuntimeError(
            "training dependencies are missing; install requirements_ml.txt"
        ) from exc

    settings = config or TrainingConfig()
    source = Path(csv_path)
    artifact = Path(model_path)
    if not source.is_file():
        raise TrainingDataError(f"training CSV not found: {source}")

    frame = pd.read_csv(source)
    if len(frame) < settings.minimum_rows:
        raise TrainingDataError(
            f"need at least {settings.minimum_rows} rows; received {len(frame)}"
        )
    if "soil_moisture_percent" not in frame.columns:
        raise TrainingDataError("missing target column: soil_moisture_percent")

    vectors: list[list[float]] = []
    targets: list[float] = []
    errors: list[str] = []
    for row_number, row in enumerate(frame.to_dict(orient="records"), start=2):
        try:
            vectors.append(SoilMoistureFeatures.from_mapping(row).to_vector())
            targets.append(validate_target(row["soil_moisture_percent"]))
        except ValueError as exc:
            errors.append(f"row {row_number}: {exc}")
    if errors:
        preview = "; ".join(errors[:10])
        suffix = f"; plus {len(errors) - 10} more" if len(errors) > 10 else ""
        raise TrainingDataError(f"invalid training rows: {preview}{suffix}")

    features = np.asarray(vectors, dtype=float)
    labels = np.asarray(targets, dtype=float)
    indexes = np.arange(len(frame))
    split_strategy = "random"

    if "farm_id" in frame.columns and frame["farm_id"].nunique(dropna=True) >= 2:
        splitter = GroupShuffleSplit(
            n_splits=1,
            test_size=settings.test_size,
            random_state=settings.random_state,
        )
        train_idx, test_idx = next(
            splitter.split(indexes, labels, groups=frame["farm_id"].astype(str))
        )
        split_strategy = "grouped_by_farm_id"
    else:
        train_idx, test_idx = train_test_split(
            indexes,
            test_size=settings.test_size,
            random_state=settings.random_state,
        )

    model = xgb.XGBRegressor(
        objective="reg:squarederror",
        n_estimators=settings.n_estimators,
        max_depth=settings.max_depth,
        learning_rate=settings.learning_rate,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=settings.random_state,
        n_jobs=-1,
    )
    model.fit(features[train_idx], labels[train_idx])
    predictions = np.clip(model.predict(features[test_idx]), 0.0, 100.0)

    mae = float(mean_absolute_error(labels[test_idx], predictions))
    rmse = float(mean_squared_error(labels[test_idx], predictions) ** 0.5)
    r2 = float(r2_score(labels[test_idx], predictions)) if len(test_idx) >= 2 else None

    artifact.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(artifact)
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    version = model_version or datetime.now(timezone.utc).strftime(
        "soil-moisture-xgb-%Y%m%dT%H%M%SZ"
    )
    metadata: dict[str, Any] = {
        "schema_version": 1,
        "model_type": "xgboost_regressor",
        "model_version": version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "artifact_sha256": digest,
        "feature_names": list(FEATURE_NAMES),
        "target_name": "soil_moisture_percent",
        "source_csv": source.name,
        "rows_total": len(frame),
        "rows_train": len(train_idx),
        "rows_test": len(test_idx),
        "split_strategy": split_strategy,
        "metrics": {
            "test_mae_percent": round(mae, 4),
            "test_rmse_percent": round(rmse, 4),
            "test_r2": round(r2, 4) if r2 is not None else None,
            "target_mae_percent": settings.target_mae_percent,
            "passes_target_mae": mae <= settings.target_mae_percent,
        },
        "training_feature_ranges": {
            name: {
                "min": float(features[train_idx, position].min()),
                "max": float(features[train_idx, position].max()),
            }
            for position, name in enumerate(FEATURE_NAMES)
        },
        "training_config": asdict(settings),
    }
    metadata_path = SoilMoistureModel.metadata_path(artifact)
    metadata_path.write_text(
        json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return metadata
