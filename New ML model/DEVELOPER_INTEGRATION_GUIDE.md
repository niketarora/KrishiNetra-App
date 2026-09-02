# KrishiNetra Crop Price Intelligence - Developer Integration Guide

This is the primary handoff document for integrating the Crop Price Intelligence feature into the KrishiNetra React Native app. Paths in this document are relative to `APP_DEVELOPER_HANDOFF/`.

## 1. What This Package Provides

The package contains:

- a dependency-free Node.js HTTP API;
- a React Native API client and ready-to-use Expo screen;
- a local SQLite database containing 1,118,899 cleaned mandi price records;
- three trained CatBoost model artifacts for 1-day, 3-day, and 7-day price-change forecasting;
- prototype buyer, transport, and storage datasets;
- configuration for price adjustments and sale recommendations; and
- a browser demo at `/crop-price-intelligence`.

The app should communicate with the Node API. It must not read the SQLite database or CatBoost files directly.

## 2. Current Capability Status

| Capability | Current implementation | Production status |
|---|---|---|
| Historical mandi prices | Local SQLite database | Real historical data |
| Crop image analysis | Deterministic fallback based on crop, moisture, and image metadata | Prototype only |
| Current fair-price range | Market price plus configurable quality rules | Prototype calculation |
| 3-day and 7-day forecast | Transparent rule-based calculation | Prototype calculation |
| CatBoost model files | Included in `backend/models/` | Trained artifacts are not connected to the Node runtime |
| Buyer matching | Synthetic buyer-demand CSV | Prototype only |
| Transport/storage costs | Rules and synthetic reference CSVs | Prototype assumptions |
| English/Hindi messages | Backend message templates | Available; supplied screen currently sends `en` |

Important: the current mobile screen does not upload image bytes. It sends `imageName` and `imageMimeType`; the fallback vision service uses that metadata with the manual crop and moisture values. A real image model requires a new upload contract or an object-storage URL and an implementation in `cropVisionService.mjs`.

## 3. Runtime Architecture

```text
React Native screen
    -> marketIntelligenceClient.ts
    -> POST /api/market-intelligence/analyse
    -> MarketIntelligenceOrchestrator
       -> crop vision fallback
       -> SQLite mandi market lookup
       -> quality adjustment rules
       -> rule-based price prediction
       -> sale recommendation
       -> synthetic buyer matching
    -> one combined JSON response
    -> result cards in the app
```

Use the combined endpoint for the app. The smaller service endpoints are mainly useful for backend development and debugging.

## 4. Prerequisites

- Node.js 24 or newer. The backend uses the built-in `node:sqlite` module.
- A React Native TypeScript app.
- For the supplied screen: Expo with `expo-image-picker`.
- For a physical phone: the phone and development computer must be on the same network, and the API port must be allowed through the computer firewall.

The backend has no third-party npm dependencies, so `npm install` is not required for this package.

## 5. Package Map

| Path | Purpose |
|---|---|
| `backend/scripts/start_crop_price_intelligence_api.mjs` | Starts the HTTP API |
| `backend/scripts/run_crop_price_intelligence_demo.mjs` | Runs one request without the mobile app |
| `backend/src/api/marketIntelligenceApi.mjs` | Routes, JSON parsing, CORS, and errors |
| `backend/src/services/marketIntelligenceOrchestrator.mjs` | Coordinates the complete analysis |
| `backend/src/services/*.mjs` | Replaceable domain services |
| `backend/config/crop_price_intelligence_rules.json` | Quality, prediction, cost, and recommendation rules |
| `backend/data/preparation.sqlite` | Read-only mandi-price database |
| `backend/models/*.cbm` | CatBoost binary model artifacts |
| `backend/prototype_data/*.csv` | Synthetic buyer/logistics/storage inputs |
| `backend/reports/` | Example response, validation report, and training metrics |
| `react-native/marketIntelligenceClient.ts` | Typed API request and response client |
| `react-native/CropPriceIntelligenceScreen.tsx` | Expo-compatible feature screen |
| `docs/API_CONTRACT.md` | Short API field reference |
| `docs/MODEL_AND_DATA_NOTES.md` | Model and dataset notes |

Do not open or edit `.sqlite` or `.cbm` files as text. They are binary files.

## 6. Start And Verify The Backend

From the handoff directory:

```powershell
cd backend
node --version
npm.cmd start
```

The Node version must be `v24` or newer. The default base URL is:

```text
http://localhost:8787
```

Use a different port when needed:

```powershell
$env:PORT = '9000'
npm.cmd start
```

Open the browser demo:

```text
http://localhost:8787/crop-price-intelligence
```

Verify the combined API from another PowerShell terminal:

```powershell
$body = @{
  imageName = 'mustard_mobile_upload.jpg'
  imageMimeType = 'image/jpeg'
  crop = 'Mustard'
  quantity = 100
  location = 'Kota'
  moisture = 9.8
  harvestDate = '2025-08-14'
  locale = 'en'
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri 'http://localhost:8787/api/market-intelligence/analyse' `
  -ContentType 'application/json' `
  -Body $body
```

You can also run the backend-only demo:

```powershell
npm.cmd run demo
```

That writes `backend/reports/crop_price_intelligence_demo.json`.

## 7. Add The React Native Files

Copy these two files into the app's feature or screen directory while keeping them next to each other:

```text
react-native/marketIntelligenceClient.ts
react-native/CropPriceIntelligenceScreen.tsx
```

Install the image picker in an Expo app:

```powershell
npx expo install expo-image-picker
```

The supplied screen imports `expo-image-picker`. In a bare React Native project, install `react-native-image-picker` and replace only the `pickImage` implementation and asset type. The API client does not depend on Expo.

## 8. Configure The API Base URL

Do not hard-code a production URL inside the screen. Store it in the app's environment configuration and pass it as the `apiBaseUrl` prop without a trailing slash.

| Runtime | Development base URL |
|---|---|
| Android emulator | `http://10.0.2.2:8787` |
| iOS simulator | `http://localhost:8787` |
| Physical device | `http://<DEVELOPMENT_COMPUTER_LAN_IP>:8787` |
| Production | `https://<YOUR_API_DOMAIN>` |

Example with Expo environment configuration:

```env
EXPO_PUBLIC_MARKET_INTELLIGENCE_API_URL=http://10.0.2.2:8787
```

```tsx
const apiBaseUrl = process.env.EXPO_PUBLIC_MARKET_INTELLIGENCE_API_URL;

if (!apiBaseUrl) {
  throw new Error('EXPO_PUBLIC_MARKET_INTELLIGENCE_API_URL is not configured');
}
```

For a physical Android device using local HTTP, Android network-security settings may block cleartext traffic. Prefer an HTTPS development tunnel or explicitly allow local cleartext traffic only in the development build. Never weaken the production network-security policy.

## 9. Add The Screen To Navigation

Basic render:

```tsx
import CropPriceIntelligenceScreen from './CropPriceIntelligenceScreen';

export default function MarketScreen() {
  return <CropPriceIntelligenceScreen apiBaseUrl={apiBaseUrl} />;
}
```

React Navigation stack example:

```tsx
<Stack.Screen
  name="CropPriceIntelligence"
  options={{ title: 'Crop Price Intelligence' }}
>
  {() => <CropPriceIntelligenceScreen apiBaseUrl={apiBaseUrl} />}
</Stack.Screen>
```

Connect the existing Market tab or its current empty state to this screen. If the app has a design system, keep `marketIntelligenceClient.ts` and rebuild the presentation with existing components rather than maintaining two visual systems.

## 10. Main API Contract

### Endpoint

```text
POST /api/market-intelligence/analyse
Content-Type: application/json
```

### Recommended Request Fields

| Field | Type | Required by mobile client | Meaning / unit | Example |
|---|---|---:|---|---|
| `imageName` | string | No | Image filename/identifier; no image bytes are sent | `mustard_mobile_upload.jpg` |
| `imageMimeType` | string | No | Image media type metadata | `image/jpeg` |
| `crop` | string | Yes | Crop/commodity name | `Mustard` |
| `quantity` | number | Yes | Quantity in quintals | `100` |
| `location` | string | Yes | District used for market lookup | `Kota` |
| `moisture` | number | No | Moisture percentage | `9.8` |
| `harvestDate` | string | No | ISO date, `YYYY-MM-DD` | `2025-08-14` |
| `locale` | `en` or `hi` | No | Message language; defaults to `en` | `en` |

Example JSON:

```json
{
  "imageName": "mustard_mobile_upload.jpg",
  "imageMimeType": "image/jpeg",
  "crop": "Mustard",
  "quantity": 100,
  "location": "Kota",
  "moisture": 9.8,
  "harvestDate": "2025-08-14",
  "locale": "en"
}
```

Use positive, finite values for `quantity`; use a moisture value from 0 to 100; and send a non-empty crop and location. The current backend does not yet enforce request validation, so the app must validate before sending and the production API should add schema validation.

Crop and location matching are case-insensitive. The supplied screen offers Gram, Mustard, Wheat, Maize, Onion, Tomato, Soybean, and Bajra. The mock vision service also recognizes Potato and Garlic in filenames, and the market database can contain additional commodities.

### Successful Response

The response is one JSON object with these top-level sections:

| Section | App usage |
|---|---|
| `crop_analysis` | Crop, grade, quality, visible damage, confidence, and mode |
| `market_intelligence` | Latest/recent mandi values, trend, history, and data mode |
| `quality_price_explanation` | Base price, adjusted price, fair range, and adjustment list |
| `price_prediction` | Current, 3-day, and 7-day ranges plus confidence and mode |
| `sale_recommendation` | Action, wait days, revenues, costs, profit difference, and reason |
| `buyer_matches` | Up to five matches ordered by net realization |
| `best_buyer` | First match or `null` |
| `result_dashboard` | Pre-composed summary values |
| `messages` | Localized title, label, and explanation |
| `data_disclosure` | Source/mode labels that identify real versus prototype outputs |

The complete TypeScript response shape is defined in `react-native/marketIntelligenceClient.ts`. Treat it as the frontend contract.

Key display fields:

```ts
result.crop_analysis.crop
result.crop_analysis.quality_grade
result.crop_analysis.quality_score
result.crop_analysis.visible_damage_percentage

result.market_intelligence.average_price
result.market_intelligence.trend_7_days

result.price_prediction.current_fair_price_min
result.price_prediction.current_fair_price_max
result.price_prediction.predicted_7_day_price_min
result.price_prediction.predicted_7_day_price_max

result.sale_recommendation.recommendation
result.sale_recommendation.recommended_wait_days
result.sale_recommendation.additional_expected_profit
result.sale_recommendation.reason

result.best_buyer?.name
result.best_buyer?.match_score
result.best_buyer?.offered_price
result.best_buyer?.net_realisation.net_realisation_per_quintal

result.messages.explanation
result.data_disclosure
```

Prices are Indian rupees per quintal unless a field explicitly represents total revenue/profit. Confidence values are decimals from 0 to 1; `match_score` and quality scores are 0 to 100.

### Errors

Current server behavior:

- `404` with `{ "error": "Not found" }` for an unknown route;
- `500` with `{ "error": "<message>" }` for malformed JSON, database errors, or processing errors; and
- permissive CORS (`*`) for development.

The supplied client throws an `Error` containing the response text for non-2xx responses. In the app, show a retry action and a short user-safe message; log the technical error through the app's existing telemetry. Add timeouts and cancellation before production use.

## 11. Other Backend Routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/crop-price-intelligence` | Browser demo |
| `POST` | `/api/crop/analyse-image` | Vision service only |
| `POST` | `/api/market/prices` | Market snapshot only |
| `POST` | `/api/price/predict` | Prediction service only |
| `POST` | `/api/sale/recommend` | Recommendation service only |
| `GET` | `/api/buyers/matches` | Informational response directing clients to the combined endpoint |

These lower-level routes do not have a stable public app contract yet. Integrate the mobile app with `/api/market-intelligence/analyse`.

## 12. Data Fallback Behavior

The market service first searches the SQLite database for the exact crop and district. If there are no exact rows, it falls back to recent rows for that crop in any district. If the crop is absent entirely, it returns a mock market value.

Always inspect these response fields before presenting data as live/real:

```ts
result.market_intelligence.mode
result.market_intelligence.disclosure
result.crop_analysis.mode
result.crop_analysis.disclosure
result.price_prediction.mode
result.price_prediction.disclosure
result.data_disclosure
```

Recommended UI behavior: show a clear `Prototype` or `Estimated` label whenever a returned mode contains `MOCK`, `PROTOTYPE`, or `SYNTHETIC`.

## 13. Replacing Prototype Services

The orchestrator already separates replaceable components:

| Production integration | File to change |
|---|---|
| Real image upload and vision inference | `backend/src/services/cropVisionService.mjs` |
| CatBoost/Python inference service | `backend/src/services/pricePredictionService.mjs` |
| Live Agmarknet/eNAM feed | `backend/src/services/marketDataService.mjs` |
| Authenticated buyer database | `backend/src/services/buyerMatchingService.mjs` |
| Real logistics/storage rates | `backend/src/services/netRealisationService.mjs` and config |
| Additional languages | `backend/src/i18n/marketIntelligenceMessages.mjs` |

Keep the combined response contract stable while replacing these services so the mobile screen does not need to change.

For real images, choose one production contract:

1. `multipart/form-data` with the image and form fields in one request; or
2. upload the image to private object storage first and send a short-lived object reference to the analysis endpoint.

Do not send large base64 images inside JSON. Validate file type and size, strip unnecessary metadata, set retention rules, and require authentication.

The included `.cbm` files cannot be loaded by the current JavaScript code. Connect them through a Python inference service or another runtime with compatible CatBoost support, then set the price service to model mode through an explicit adapter.

## 14. Production Checklist

Before release:

- deploy the API behind HTTPS;
- add authentication and authorization;
- restrict CORS to the app/admin origins that need browser access;
- add JSON body-size limits and request schema validation;
- add request timeouts, structured logs, tracing, and health/readiness endpoints;
- rate-limit analysis requests;
- protect image and farmer data with retention and deletion policies;
- move configuration and secrets into the deployment environment;
- use a read-only database mount or managed data service;
- connect a real vision model and price-model inference path;
- replace synthetic buyers and cost assumptions with verified sources;
- surface data timestamps, modes, and prototype disclosures in the UI;
- add API versioning before external clients depend on the contract;
- add automated contract, integration, and device tests; and
- have agricultural/domain owners approve recommendation language and thresholds.

This package is a prototype decision-support feature. Do not represent its forecasts, image scores, buyer matches, or sale recommendations as guaranteed financial outcomes.

## 15. Integration Acceptance Checklist

- [ ] Backend starts on Node 24+ without additional packages.
- [ ] Browser demo opens at `/crop-price-intelligence`.
- [ ] PowerShell test request returns all documented response sections.
- [ ] Android emulator uses `10.0.2.2`, not `localhost`.
- [ ] Physical device can reach the development computer and API port.
- [ ] App requests camera/photo-library permission only when needed.
- [ ] Crop, quantity, location, moisture, and date are validated before submission.
- [ ] Loading, error, empty, retry, and successful-result states work.
- [ ] Currency is formatted as INR and quantity is labeled in quintals.
- [ ] `best_buyer: null` does not crash the UI.
- [ ] Prototype/fallback modes are visibly disclosed.
- [ ] The screen follows the app's navigation, localization, analytics, and design-system conventions.
- [ ] Production URL comes from environment configuration.
- [ ] Release build uses HTTPS and authenticated endpoints.

## 16. Troubleshooting

### `node:sqlite` cannot be found

Upgrade the backend runtime to Node.js 24 or newer and confirm with `node --version`.

### PowerShell says `npm.ps1` cannot be loaded

Use `npm.cmd start` and `npm.cmd run demo`, as shown above. You can also bypass npm and run `node scripts/start_crop_price_intelligence_api.mjs` directly. Do not change the computer-wide execution policy just to run this package.

### Android emulator cannot connect

Use `http://10.0.2.2:8787`. `localhost` inside the emulator points to the emulator itself.

### Physical phone cannot connect

Use the development computer's LAN IP, keep both devices on the same network, confirm the backend is running, and allow the selected port through the firewall. Guest Wi-Fi may block device-to-device traffic.

### Local HTTP request is blocked on Android

Use an HTTPS tunnel for development or a development-only network security configuration. Keep production traffic on HTTPS.

### No exact district data is returned

Inspect `market_intelligence.mode`. `REAL_DATABASE_CROP_FALLBACK` means the service found the crop but used another district. `MOCK_MARKET_FALLBACK` means the crop was absent from the database.

### Image selection works but results do not change with image content

This is expected in the prototype. Only image metadata is sent, and the vision fallback does not inspect image pixels.

### VS Code cannot display `.cbm` or `.sqlite`

This is expected. Those files are binary artifacts consumed by the backend or a future inference adapter.

## 17. Handoff Notes For The App Team

The lowest-risk first integration is:

1. Run the backend package unchanged.
2. Add the typed client to the app's data layer.
3. Mount the supplied screen behind the existing Market tab.
4. Apply the app's normal theme, navigation, localization, telemetry, and error components.
5. Keep all prototype disclosures visible during testing and demos.
6. Stabilize and version the API contract before replacing prototype services.

For a short endpoint-only reference, see `docs/API_CONTRACT.md`. For artifact provenance and replacement notes, see `docs/MODEL_AND_DATA_NOTES.md`.
