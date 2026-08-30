"""Training, the experiment ladder, and final model artifacts.

Covers ML1 doc sections 27-32, 40 and 52.

    python -m src.train --stage experiments
    python -m src.train --stage walkforward --model hist_gbr
    python -m src.train --stage final --model hist_gbr --feature-set full
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd

from src import (
    config,
    data_loader,
    evaluate,
    experiments,
    features,
    models,
    preprocessing,
    split,
    targets,
)


def _matrix(frame: pd.DataFrame, feature_cols: list[str]) -> np.ndarray:
    return frame[feature_cols].to_numpy(dtype=float)


def fit_impute_medians(frame: pd.DataFrame, feature_cols: list[str]) -> np.ndarray:
    """Column medians from the training rows only, for models that reject NaN."""
    return np.nanmedian(_matrix(frame, feature_cols), axis=0)


def apply_impute(matrix: np.ndarray, medians: np.ndarray) -> np.ndarray:
    filled = np.where(np.isnan(matrix), medians, matrix)
    return np.nan_to_num(filled, nan=0.0, posinf=0.0, neginf=0.0)


def fit_predict(
    model_name: str,
    params: dict | None,
    train_df: pd.DataFrame,
    eval_frames: dict[str, pd.DataFrame],
    feature_cols: list[str],
    horizon: int,
    target_mode: str | None = None,
):
    """Fit on ``train_df`` and predict each frame in ``eval_frames``.

    Predictions are always returned on the price scale, whatever the model was
    trained to output. Returns the fitted model, the predictions per frame, and
    the wall-clock fit time so section 39's cost criteria can be reported.
    """
    target_col = targets.target_column(horizon)
    target_mode = target_mode or config.TARGET_MODE
    model = models.build(model_name, params)

    x_train = _matrix(train_df, feature_cols)
    y_train = train_df[target_col].to_numpy(dtype=float)
    if target_mode == "delta":
        y_train = y_train - train_df[config.PRICE_COL].to_numpy(dtype=float)

    medians = None
    if model_name in models.NEEDS_IMPUTATION:
        medians = fit_impute_medians(train_df, feature_cols)
        x_train = apply_impute(x_train, medians)

    started = time.perf_counter()
    model.fit(x_train, y_train)
    fit_seconds = time.perf_counter() - started

    predictions = {}
    for name, frame in eval_frames.items():
        if frame.empty:
            continue
        matrix = _matrix(frame, feature_cols)
        if medians is not None:
            matrix = apply_impute(matrix, medians)
        predicted = model.predict(matrix)
        if target_mode == "delta":
            predicted = predicted + frame[config.PRICE_COL].to_numpy(dtype=float)
        predictions[name] = predicted

    return model, predictions, fit_seconds, medians


def run_experiment_ladder(
    model_names: list[str] | None = None,
    feature_sets: tuple[str, ...] = features.FEATURE_SETS,
    horizons=config.HORIZONS,
) -> pd.DataFrame:
    """Doc section 52: add one family of features at a time, per model.

    Every result is scored on the 2024 validation period. The 2025 test period
    is not touched anywhere in this function.
    """
    bundle = preprocessing.load_bundle()
    df = bundle["data"]
    all_features = bundle["feature_columns"]

    if model_names is None:
        model_names = [m for m in models.available_models() if m != "extra_trees"]

    rows = []
    for model_name in model_names:
        for feature_set in feature_sets:
            selected = features.select_feature_set(all_features, feature_set)
            for horizon in horizons:
                parts = split.chronological_split(df, horizon)
                summary = parts.summary()

                _, predictions, fit_seconds, _ = fit_predict(
                    model_name,
                    None,
                    parts.train,
                    {"valid": parts.valid},
                    selected,
                    horizon,
                )
                metrics = evaluate.all_metrics(
                    parts.valid[targets.target_column(horizon)], predictions["valid"]
                )

                experiments.log(
                    f"exp_ladder_{model_name}_{feature_set}",
                    model=model_name,
                    horizon=horizon,
                    split="valid",
                    metrics=metrics,
                    train_period=f"{summary['train']['from']}..{summary['train']['to']}",
                    validation_period=f"{summary['valid']['from']}..{summary['valid']['to']}",
                    n_features=len(selected),
                    hyperparameters=models.DEFAULT_PARAMS.get(model_name, {}),
                    notes=f"feature_set={feature_set}; fit={fit_seconds:.1f}s",
                )

                row = {
                    "model": model_name,
                    "feature_set": feature_set,
                    "n_features": len(selected),
                    "horizon": f"{horizon}d",
                    "fit_seconds": round(fit_seconds, 1),
                    **metrics,
                }
                rows.append(row)
                print(
                    f"  {model_name:14s} {feature_set:8s} {horizon}d  "
                    f"MAE={metrics['MAE']:8.3f}  RMSE={metrics['RMSE']:8.3f}  "
                    f"({fit_seconds:.1f}s)"
                )

    table = pd.DataFrame(rows)
    table.to_csv(config.METRICS_DIR / "experiment_ladder.csv", index=False)
    return table


def walk_forward_evaluate(
    model_name: str,
    params: dict | None,
    feature_cols: list[str],
    horizon: int,
    df: pd.DataFrame,
    n_folds: int = 3,
) -> dict:
    """Expanding-window validation (doc section 25). Mean MAE across folds."""
    target_col = targets.target_column(horizon)
    fold_metrics = []

    for i, (train_df, valid_df) in enumerate(
        split.walk_forward_folds(df, horizon, n_folds), start=1
    ):
        _, predictions, _, _ = fit_predict(
            model_name, params, train_df, {"valid": valid_df}, feature_cols, horizon
        )
        metrics = evaluate.all_metrics(valid_df[target_col], predictions["valid"])
        metrics["fold"] = i
        metrics["valid_to"] = str(valid_df[config.DATE_COL].max().date())
        fold_metrics.append(metrics)

    maes = [m["MAE"] for m in fold_metrics if np.isfinite(m["MAE"])]
    return {
        "folds": fold_metrics,
        "mean_MAE": float(np.mean(maes)) if maes else float("nan"),
        "std_MAE": float(np.std(maes)) if maes else float("nan"),
    }


def train_final(
    model_name: str,
    feature_set: str = "full",
    params_per_horizon: dict[int, dict] | None = None,
    horizons=config.HORIZONS,
) -> dict:
    """Doc section 40: refit on train+validation, then score the test period once.

    The test period is used for reporting only — no parameter, feature set or
    model choice is made from it.
    """
    bundle = preprocessing.load_bundle()
    df = bundle["data"]
    selected = features.select_feature_set(bundle["feature_columns"], feature_set)
    params_per_horizon = params_per_horizon or {}

    results: dict[int, dict] = {}
    detail: dict[str, dict] = {}
    importances: dict[str, dict] = {}

    for horizon in horizons:
        parts = split.chronological_split(df, horizon)
        summary = parts.summary()
        target_col = targets.target_column(horizon)

        # Train + validation, with the same embargo applied at the test boundary.
        fit_frame = pd.concat([parts.train, parts.valid]).sort_values(
            config.GROUP_KEYS + [config.DATE_COL]
        )
        params = params_per_horizon.get(horizon)

        model, predictions, fit_seconds, medians = fit_predict(
            model_name, params, fit_frame, {"test": parts.test}, selected, horizon
        )
        y_pred = predictions["test"]
        metrics = evaluate.all_metrics(parts.test[target_col], y_pred)
        results[horizon] = metrics

        scored = parts.test.copy()
        scored["y_pred"] = y_pred
        scored["error"] = scored["y_pred"] - scored[target_col]
        detail[f"{horizon}d"] = evaluate.segmented_report(scored, target_col, "y_pred")

        importance = models.feature_importance(model, selected)
        if importance:
            importances[f"{horizon}d"] = importance
            pd.Series(importance).rename("importance").to_csv(
                config.IMPORTANCE_DIR / f"{model_name}_{horizon}d.csv",
                index_label="feature",
            )

        artifact = {
            "model": model,
            "model_name": model_name,
            "horizon": horizon,
            "target_mode": config.TARGET_MODE,
            "feature_columns": selected,
            "impute_medians": medians,
            "params": {**models.DEFAULT_PARAMS.get(model_name, {}), **(params or {})},
            "category_maps": bundle["category_maps"],
            "imputation_stats": bundle["imputation_stats"],
            "trained_on": f"{summary['train']['from']}..{summary['valid']['to']}",
        }
        joblib.dump(artifact, config.MODELS_DIR / f"wheat_price_{horizon}d.pkl", compress=3)

        scored[
            config.GROUP_KEYS + [config.DATE_COL, config.PRICE_COL, target_col, "y_pred", "error"]
        ].to_csv(config.METRICS_DIR / f"test_predictions_{horizon}d.csv", index=False)

        experiments.log(
            f"exp_final_{model_name}",
            model=model_name,
            horizon=horizon,
            split="test",
            metrics=metrics,
            train_period=f"{summary['train']['from']}..{summary['valid']['to']}",
            test_period=f"{summary['test']['from']}..{summary['test']['to']}",
            n_features=len(selected),
            hyperparameters=artifact["params"],
            notes=f"final refit on train+valid; feature_set={feature_set}; fit={fit_seconds:.1f}s",
        )
        print(
            f"  {model_name} {horizon}d  test MAE={metrics['MAE']:.3f}  "
            f"RMSE={metrics['RMSE']:.3f}  MAPE={metrics['MAPE']:.4f}%"
        )

    schema = {
        "feature_columns": selected,
        "n_features": len(selected),
        "feature_set": feature_set,
        "group_keys": config.GROUP_KEYS,
        "date_column": config.DATE_COL,
        "price_column": config.PRICE_COL,
        "horizons": list(horizons),
        "target_mode": config.TARGET_MODE,
    }
    with open(config.MODELS_DIR / "feature_schema.json", "w", encoding="utf-8") as fh:
        json.dump(schema, fh, indent=2)

    metadata = {
        "model": model_name,
        "feature_set": feature_set,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "random_state": config.RANDOM_STATE,
        "target_mode": config.TARGET_MODE,
        "raw_dataset": str(config.RAW_DATASET),
        "raw_dataset_sha256": data_loader.dataset_hash(),
        "dataset_is_synthetic": True,
        "accuracy_caveat": (
            "All metrics are measured on the synthetic Rajasthan wheat dataset "
            "and must not be presented as validated real-world performance."
        ),
        "train_period": f"..{config.TRAIN_END}",
        "validation_period": f"{config.VALID_START}..{config.VALID_END}",
        "test_period": f"{config.TEST_START}..",
        "embargo_applied": config.USE_EMBARGO,
        "test_metrics": {f"{h}d": m for h, m in results.items()},
        "hyperparameters": {
            f"{h}d": {**models.DEFAULT_PARAMS.get(model_name, {}), **params_per_horizon.get(h, {})}
            for h in horizons
        },
    }
    with open(config.MODELS_DIR / "metadata.json", "w", encoding="utf-8") as fh:
        json.dump(metadata, fh, indent=2, default=str)

    with open(config.METRICS_DIR / "final_test_report.json", "w", encoding="utf-8") as fh:
        json.dump(detail, fh, indent=2, default=str)

    if importances:
        with open(
            config.IMPORTANCE_DIR / f"{model_name}_importance.json", "w", encoding="utf-8"
        ) as fh:
            json.dump(
                {k: dict(list(v.items())[:40]) for k, v in importances.items()},
                fh,
                indent=2,
            )

    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Train ML Model 1")
    parser.add_argument(
        "--stage",
        choices=("experiments", "walkforward", "final"),
        default="experiments",
    )
    parser.add_argument("--model", default="hist_gbr")
    parser.add_argument(
        "--models",
        default="",
        help="comma-separated models for the experiment ladder (default: all available)",
    )
    parser.add_argument("--feature-set", default="full", choices=features.FEATURE_SETS)
    parser.add_argument("--horizons", default=",".join(str(h) for h in config.HORIZONS))
    args = parser.parse_args()

    horizons = tuple(int(h) for h in args.horizons.split(","))
    print(f"available models: {models.available_models()}")

    if args.stage == "experiments":
        chosen = [m.strip() for m in args.models.split(",") if m.strip()] or None
        table = run_experiment_ladder(model_names=chosen, horizons=horizons)
        print("\n" + table.to_string(index=False))
    elif args.stage == "walkforward":
        bundle = preprocessing.load_bundle()
        selected = features.select_feature_set(
            bundle["feature_columns"], args.feature_set
        )
        out = {}
        for horizon in horizons:
            out[f"{horizon}d"] = walk_forward_evaluate(
                args.model, None, selected, horizon, bundle["data"]
            )
            print(
                f"  {args.model} {horizon}d  walk-forward mean MAE="
                f"{out[f'{horizon}d']['mean_MAE']:.3f} "
                f"(sd {out[f'{horizon}d']['std_MAE']:.3f})"
            )
        with open(
            config.METRICS_DIR / f"walk_forward_{args.model}.json", "w", encoding="utf-8"
        ) as fh:
            json.dump(out, fh, indent=2, default=str)
    else:
        tuned_path = config.MODELS_DIR / "tuned_params.json"
        params_per_horizon = {}
        if tuned_path.exists():
            raw = json.loads(tuned_path.read_text(encoding="utf-8"))
            if raw.get("model") == args.model:
                params_per_horizon = {
                    int(k.rstrip("d")): v for k, v in raw["params"].items()
                }
                print(f"using tuned parameters from {tuned_path}")
        train_final(args.model, args.feature_set, params_per_horizon, horizons)


if __name__ == "__main__":
    main()
