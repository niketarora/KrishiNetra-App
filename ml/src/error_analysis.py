"""Diagnostic error analysis on the test period (ML1 doc sections 35-37).

The point is to explain *where* and *when* the model fails, not to restate the
headline score.

    python -m src.error_analysis
"""

from __future__ import annotations

import json

import numpy as np
import pandas as pd

from src import config, evaluate, preprocessing, targets

SEASONS = {
    1: "winter", 2: "winter", 3: "harvest", 4: "harvest", 5: "harvest",
    6: "monsoon", 7: "monsoon", 8: "monsoon", 9: "monsoon",
    10: "post_monsoon", 11: "post_monsoon", 12: "winter",
}


def load_predictions(horizon: int) -> pd.DataFrame:
    """Test-period predictions written by the final training stage."""
    path = config.METRICS_DIR / f"test_predictions_{horizon}d.csv"
    if not path.exists():
        raise FileNotFoundError(
            f"{path} not found. Run `python -m src.train --stage final` first."
        )
    return pd.read_csv(path, parse_dates=[config.DATE_COL])


def enrich(frame: pd.DataFrame, horizon: int, context: pd.DataFrame) -> pd.DataFrame:
    """Attach the market context needed to segment the errors."""
    target_col = targets.target_column(horizon)
    context_cols = [
        *config.GROUP_KEYS,
        config.DATE_COL,
        "arrivals_tonnes",
        "rainfall_mm",
        "temperature_c",
        "price_pct_change_7d",
        "price_roll_std_7",
    ]
    merged = frame.merge(
        context[[c for c in context_cols if c in context.columns]],
        on=config.GROUP_KEYS + [config.DATE_COL],
        how="left",
    )

    merged["abs_error"] = merged["error"].abs()
    merged["pct_error"] = merged["abs_error"] / merged[target_col].abs().clip(lower=1.0) * 100
    merged["season"] = merged[config.DATE_COL].dt.month.map(SEASONS)

    # Regimes the doc asks about explicitly: rapid price moves, high arrivals,
    # unusual weather. Thresholds are quantiles of the test period itself, so
    # they describe the conditions rather than encode a prior.
    move = merged["price_pct_change_7d"].abs()
    merged["price_regime"] = np.where(
        move >= move.quantile(0.9), "rapid_move",
        np.where(move <= move.quantile(0.5), "stable", "moderate"),
    )
    arrivals = merged["arrivals_tonnes"]
    merged["arrivals_regime"] = np.where(
        arrivals >= arrivals.quantile(0.9), "high_arrivals",
        np.where(arrivals <= arrivals.quantile(0.1), "low_arrivals", "normal"),
    )
    merged["rain_regime"] = np.where(
        merged["rainfall_mm"] > 0, "rain", "dry"
    )
    return merged


def analyse_horizon(horizon: int, context: pd.DataFrame) -> dict:
    target_col = targets.target_column(horizon)
    frame = enrich(load_predictions(horizon), horizon, context)

    report: dict = {
        "horizon": f"{horizon}d",
        "overall": evaluate.all_metrics(frame[target_col], frame["y_pred"]),
        "bias_mean_error": round(float(frame["error"].mean()), 3),
        "error_quantiles": {
            q: round(float(frame["abs_error"].quantile(q)), 3)
            for q in (0.5, 0.75, 0.9, 0.95, 0.99)
        },
    }

    for segment in ("mandi", "variety", "grade", "season", "price_regime", "arrivals_regime", "rain_regime"):
        report[f"by_{segment}"] = evaluate.metrics_by(
            frame, target_col, "y_pred", segment
        ).to_dict("records")

    worst = frame.nlargest(25, "abs_error")[
        [
            *config.GROUP_KEYS,
            config.DATE_COL,
            config.PRICE_COL,
            target_col,
            "y_pred",
            "error",
            "price_regime",
            "arrivals_regime",
        ]
    ]
    report["worst_25_predictions"] = json.loads(
        worst.to_json(orient="records", date_format="iso")
    )

    return report


def run() -> dict:
    context = preprocessing.load_bundle()["data"]
    reports = {f"{h}d": analyse_horizon(h, context) for h in config.HORIZONS}

    with open(config.METRICS_DIR / "error_analysis.json", "w", encoding="utf-8") as fh:
        json.dump(reports, fh, indent=2, default=str)

    return reports


if __name__ == "__main__":
    all_reports = run()
    for key, report in all_reports.items():
        print(f"\n=== +{key} ===")
        print(f"overall: {report['overall']}")
        print(f"mean signed error (bias): {report['bias_mean_error']}")
        print("\nworst mandis by MAE:")
        print(pd.DataFrame(report["by_mandi"]).head(5).to_string(index=False))
        print("\nby price regime:")
        print(pd.DataFrame(report["by_price_regime"]).to_string(index=False))
    print(f"\nfull report -> {config.METRICS_DIR / 'error_analysis.json'}")
