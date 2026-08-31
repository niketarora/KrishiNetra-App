"""Model registry (ML1 doc section 27).

XGBoost and LightGBM are the doc's Models A and B. They register themselves
only if importable, so the pipeline runs end to end on whatever is installed
and picks them up automatically once they are available. Scikit-learn's
histogram gradient booster is the same class of algorithm and is the working
stand-in; random forest and extra trees are the doc's optional Model C.
"""

from __future__ import annotations

from typing import Callable

import numpy as np

from src import config

ModelFactory = Callable[[dict], object]

# Models that cannot consume NaN and need imputation first.
NEEDS_IMPUTATION = {"random_forest", "extra_trees"}

DEFAULT_PARAMS: dict[str, dict] = {
    "hist_gbr": {
        "max_iter": 600,
        "learning_rate": 0.05,
        "max_depth": None,
        "max_leaf_nodes": 31,
        "min_samples_leaf": 40,
        "l2_regularization": 1.0,
        "early_stopping": False,
        "random_state": config.RANDOM_STATE,
    },
    "random_forest": {
        "n_estimators": 300,
        "max_depth": None,
        "min_samples_leaf": 5,
        "n_jobs": -1,
        "random_state": config.RANDOM_STATE,
    },
    "extra_trees": {
        "n_estimators": 300,
        "max_depth": None,
        "min_samples_leaf": 5,
        "n_jobs": -1,
        "random_state": config.RANDOM_STATE,
    },
    "xgboost": {
        "n_estimators": 800,
        "max_depth": 6,
        "learning_rate": 0.05,
        "subsample": 0.9,
        "colsample_bytree": 0.8,
        "min_child_weight": 5,
        "gamma": 0.0,
        "reg_alpha": 0.0,
        "reg_lambda": 1.0,
        "tree_method": "hist",
        "n_jobs": -1,
        "random_state": config.RANDOM_STATE,
    },
    "lightgbm": {
        "n_estimators": 800,
        "learning_rate": 0.05,
        "num_leaves": 31,
        "max_depth": -1,
        "min_child_samples": 30,
        "subsample": 0.9,
        "subsample_freq": 1,
        "colsample_bytree": 0.8,
        "reg_alpha": 0.0,
        "reg_lambda": 1.0,
        "n_jobs": -1,
        "random_state": config.RANDOM_STATE,
        "verbose": -1,
    },
}


def _hist_gbr(params: dict):
    from sklearn.ensemble import HistGradientBoostingRegressor

    return HistGradientBoostingRegressor(**params)


def _random_forest(params: dict):
    from sklearn.ensemble import RandomForestRegressor

    return RandomForestRegressor(**params)


def _extra_trees(params: dict):
    from sklearn.ensemble import ExtraTreesRegressor

    return ExtraTreesRegressor(**params)


def _xgboost(params: dict):
    from xgboost import XGBRegressor

    return XGBRegressor(**params)


def _lightgbm(params: dict):
    from lightgbm import LGBMRegressor

    return LGBMRegressor(**params)


_FACTORIES: dict[str, ModelFactory] = {
    "hist_gbr": _hist_gbr,
    "random_forest": _random_forest,
    "extra_trees": _extra_trees,
    "xgboost": _xgboost,
    "lightgbm": _lightgbm,
}

_IMPORT_NAMES = {
    "hist_gbr": "sklearn",
    "random_forest": "sklearn",
    "extra_trees": "sklearn",
    "xgboost": "xgboost",
    "lightgbm": "lightgbm",
}


def is_available(name: str) -> bool:
    """Whether the backing library for this model is importable."""
    import importlib.util

    module = _IMPORT_NAMES.get(name)
    if module is None:
        return False
    return importlib.util.find_spec(module) is not None


def available_models() -> list[str]:
    return [name for name in _FACTORIES if is_available(name)]


def build(name: str, params: dict | None = None):
    """Instantiate a model by name, merging overrides onto the defaults."""
    if name not in _FACTORIES:
        raise ValueError(
            f"Unknown model {name!r}; known models are {sorted(_FACTORIES)}"
        )
    if not is_available(name):
        raise ImportError(
            f"Model {name!r} requires the {_IMPORT_NAMES[name]!r} package, "
            "which is not installed. See ml/requirements.txt."
        )
    merged = {**DEFAULT_PARAMS.get(name, {}), **(params or {})}
    return _FACTORIES[name](merged)


def feature_importance(model, feature_names: list[str]) -> dict[str, float] | None:
    """Native importances where the estimator exposes them."""
    values = getattr(model, "feature_importances_", None)
    if values is None:
        return None
    scores = {
        name: float(score) for name, score in zip(feature_names, np.asarray(values))
    }
    return dict(sorted(scores.items(), key=lambda kv: -kv[1]))
