# Models

This folder contains trained CatBoost model binaries.

Do not open `.cbm` files as text. They are loaded by backend code.

Files:

```text
catboost_modal_price_1d.cbm
catboost_modal_price_3d.cbm
catboost_modal_price_7d.cbm
```

Use through:

```text
src/services/pricePredictionService.mjs
```
