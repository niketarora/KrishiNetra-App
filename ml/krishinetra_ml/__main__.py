"""Command-line entry point for training and local inference."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Sequence

from .features import SoilMoistureFeatures
from .soil_moisture import SoilMoistureModel
from .training import TrainingConfig, train_from_csv


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m krishinetra_ml")
    commands = parser.add_subparsers(dest="command", required=True)

    train = commands.add_parser("train", help="train an XGBoost model from CSV")
    train.add_argument("--input", required=True, type=Path)
    train.add_argument("--model-out", required=True, type=Path)
    train.add_argument("--model-version")
    train.add_argument("--minimum-rows", type=int, default=30)
    train.add_argument("--target-mae", type=float, default=10.0)

    predict = commands.add_parser("predict", help="run one local prediction")
    predict.add_argument("--model", required=True, type=Path)
    predict.add_argument("--features-json", required=True, type=Path)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "train":
        metadata = train_from_csv(
            args.input,
            args.model_out,
            model_version=args.model_version,
            config=TrainingConfig(
                minimum_rows=args.minimum_rows,
                target_mae_percent=args.target_mae,
            ),
        )
        print(json.dumps(metadata, indent=2, sort_keys=True))
        return 0 if metadata["metrics"]["passes_target_mae"] else 2

    values = json.loads(args.features_json.read_text(encoding="utf-8"))
    model = SoilMoistureModel.load(args.model)
    prediction = model.predict(SoilMoistureFeatures.from_mapping(values))
    print(json.dumps(prediction.to_dict(), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
