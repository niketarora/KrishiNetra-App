# KrishiNetra App Developer Handoff

This folder contains the files needed to integrate **Crop Image to Price Intelligence** into the React Native app.

## Start Here

1. Read `docs/INTEGRATION_GUIDE.md`.
2. Start the backend:

```powershell
cd backend
node scripts/start_crop_price_intelligence_api.mjs
```

3. In React Native, use the files in `react-native/`.

## Important

Do not open these files in a text editor:

- `backend/models/*.cbm`
- `backend/data/preparation.sqlite`

They are binary artifacts:

- `.cbm` = trained CatBoost model files
- `.sqlite` = local mandi price database

The app should call the backend API. It should not read model/database files directly.

## What Is Included

- `backend/`: Node API and service layer
- `backend/models/`: trained CatBoost model binaries
- `backend/data/`: SQLite price database
- `react-native/`: drop-in React Native screen and API client
- `docs/`: API contract, dataset notes, and model notes

## Current Status

Real:

- 1,118,899 mandi price records in SQLite
- trained CatBoost model files for 1-day, 3-day, and 7-day price change forecasting

Prototype:

- crop image analysis fallback
- buyer matching data
- transport and storage assumptions
- rule-based app-facing price range layer
