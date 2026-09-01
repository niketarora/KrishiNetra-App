"""Command-line entry point for OASSM-10 model inference."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Sequence

from .oassm import (
    OASSMFeatures,
    OASSMPrediction,
    OASSMTransformerPredictor,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m krishinetra_ml")
    commands = parser.add_subparsers(dest="command", required=True)

    predict = commands.add_parser("predict", help="run 10m multi-sensor soil moisture prediction")
    predict.add_argument("--features-json", required=True, type=Path)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "predict":
        values = json.loads(args.features_json.read_text(encoding="utf-8"))
        predictor = OASSMTransformerPredictor()
        prediction = predictor.predict(OASSMFeatures(**values))
        print(json.dumps(prediction.to_dict(), indent=2, sort_keys=True))
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
