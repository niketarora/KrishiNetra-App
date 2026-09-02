# Handoff Manifest

## Give This Folder To App Developer

```text
APP_DEVELOPER_HANDOFF/
```

## Main Files

| Path | Purpose | Open In Editor? |
|---|---|---|
| `README.md` | First instructions | Yes |
| `docs/INTEGRATION_GUIDE.md` | React Native integration steps | Yes |
| `docs/API_CONTRACT.md` | Request/response contract | Yes |
| `docs/MODEL_AND_DATA_NOTES.md` | Explains model/database files | Yes |
| `react-native/CropPriceIntelligenceScreen.tsx` | Drop-in React Native screen | Yes |
| `react-native/marketIntelligenceClient.ts` | API client for app | Yes |
| `backend/package.json` | Backend start commands | Yes |
| `backend/scripts/start_crop_price_intelligence_api.mjs` | Starts local API | Yes |
| `backend/src/api/marketIntelligenceApi.mjs` | HTTP endpoints | Yes |
| `backend/src/services/*.mjs` | Modular service logic | Yes |
| `backend/config/crop_price_intelligence_rules.json` | Configurable rules | Yes |
| `backend/models/*.cbm` | Trained CatBoost models | No, binary |
| `backend/data/preparation.sqlite` | Real mandi price database | No, binary |
| `backend/prototype_data/*.csv` | Prototype buyer/logistics/storage data | Yes |

## Binary Files Are Normal

If VS Code says a `.cbm` or `.sqlite` file cannot be displayed, that is expected. These files are consumed by code.
