# KrishiNetra — Mapbox boundary editor, GPS field location, field-coordinate weather

## Context

Three connected problems, all rooted in the same gap: the app knows a field's polygon but never captures where the farmer actually is, and the map that should show them is broken.

1. **The boundary map does not render.** `BoundaryMap.tsx` uses `react-native-maps` with `PROVIDER_GOOGLE`. The prebuilt `mobile/android/` manifest carries the literal placeholder `your-android-maps-key`, and no EAS profile passes `GOOGLE_MAPS_ANDROID_API_KEY` at all — so the farmer gets a grey tile with an auth failure in logcat. Mapbox replaces it.
2. **GPS is captured nowhere that matters.** `FieldLocationScreen` (the only `getCurrentPositionAsync` caller in a draw flow) sits behind `OnboardingNavigator`, which `RootNavigator` never renders — it is unreachable dead code. So `EditBoundary` opens on a stored centroid or, for a fresh draw, on `FALLBACK_CENTRE` = the geographic centre of India. GPS accuracy is read once and thrown away; there is no column for it.
3. **Weather is district-granular and CLI-gated.** `GET /api/v1/weather?farmId=` is already field-scoped (farm → its district/state), so it is not device GPS and not a hardcoded city. But the reading is for a district, and the weather table is filled only by a manual `npm run ingest:weather`. A farmer who saves a boundary today sees "unavailable" until someone runs a script.

**Intended outcome:** the farmer opens Edit Boundary, lands on satellite imagery of their own field, draws or corrects it, and saves a polygon plus a representative coordinate plus the GPS accuracy that produced it — and the Home weather card then reads the weather for that coordinate, immediately.

---

## Decisions already taken with the user:

- Weather moves to field coordinates with an on-demand fetch (not district, not CLI-only).
- The field's representative point stays `centroid_lat`/`centroid_lng` — they already are exactly that, server-derived and verified. Only `location_accuracy` is new. No duplicate latitude/longitude pair.
- The Mapbox public token lives in `mobile/.env` as an env var, never in a tracked file.

---

## ⚠️ Blocking manual step (one line, do this first)

`mobile/.env` currently reads:
```env
EXPO_PUBLIC_MAPBOX_ACCESS=pk.…
```
The name is missing the `_TOKEN` suffix. The value is a valid `pk.` public token. Rename the key to:
```env
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.…
```
`EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` is the canonical name used throughout this plan and documented in `.env.example`.

---

## 1. Mapbox replaces Google Maps (boundary map only)

Google Maps is used for nothing else in the app — verified: `react-native-maps` has exactly three import sites, two of which are `import type { Region }` and erase at compile time. Removal is clean.

### Package + native config

- `npx expo install @rnmapbox/maps` (`10.3.5` — peer `react-native >=0.79`, ships full Fabric/TurboModule codegen specs, so RN 0.86's bridgeless-only runtime is supported).
- `mobile/app.config.ts`: add `'@rnmapbox/maps'` to plugins; delete `android.config.googleMaps` and rewrite the stale file header doc-block (:3-8) which is entirely about the Google key. Change expo-location's `locationAlwaysAndWhenInUsePermission` → `locationWhenInUsePermission` with the KrishiNetra-specific wording from §14 of the brief. `android.permissions` already lists only `ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION` — no background permission is added.
- The `RNMapboxMapsDownloadToken` plugin option is deprecated upstream ("no longer required by Mapbox"). Only the runtime `pk.` token is needed — so no secret download token, no Maven credentials, nothing new to keep out of git beyond what `.gitignore` already covers.
- `mobile/eas.json`: add `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` to the preview profile's env (it whitelists only two vars today, so preview APKs would otherwise ship a blank map — the same failure Google Maps has now).

### Rewrite `mobile/src/components/farm/BoundaryMap.tsx`

Same visual result, same interaction, rnmapbox underneath:

| Today (`react-native-maps`) | New (`@rnmapbox/maps`) |
|---|---|
| `<MapView provider={PROVIDER_GOOGLE} mapType="satellite">` | `<MapView styleURL={StyleURL.SatelliteStreet}>` — satellite plus roads/labels, so nearby land and roads are legible (brief §3) |
| `initialRegion={region}` | `<Camera>` with `defaultSettings` + explicit `setCamera` on the one-shot initial move |
| `<Polygon coordinates strokeColor fillColor>` | `<ShapeSource>` + `<FillLayer>` + `<LineLayer>` using the same `colors.primary` / `colors.polygonFill` tokens |
| `<Marker draggable onDragEnd>` per vertex | `<PointAnnotation draggable onDragEnd>` per vertex — verified to support both props |
| `showsUserLocation` blue dot | `<LocationPuck>` |
| `onMapReady` | `onDidFinishLoadingMap` and `onMapLoadingError` |

**Fixes folded in, each one a real failure mode:**
- **Coordinate order stays a single-site concern.** rnmapbox speaks `Position = [lng, lat]`; the app speaks `LatLng`. `mobile/src/utils/geo.ts:31-37` states the swap "is done in exactly one place" because getting it backwards "silently produces a plausible-looking but wrong area". So add `toPosition`/`fromPosition` to `geo.ts` with unit tests, and let `BoundaryMap` call them — do not open a second conversion site.
- **Recenter lives inside `BoundaryMap`** as a floating control over the map (same pattern as the existing "Satellite view" pill), not as a screen-level button. A parent button cannot reach the child's `<Camera>` through a callback prop, and this avoids `memo(forwardRef(…))` plumbing entirely.
- **`onMapLoadingError` → `setMapFailed(true)`.** A Mapbox map with a bad token finishes loading the frame and then fails tile requests, so `onDidFinishLoadingMap` still fires and the existing 12 s watchdog would never trip — the farmer would see a silent blank map.
- **Props type moves to `BoundaryMap.types.ts`**, imported by both `BoundaryMap.tsx` and `BoundaryMap.web.tsx`. Today the web stub declares its own `Props` and, because TS resolves the `.tsx` file, it is never type-checked against its call sites — it can drift silently. Keep the web stub otherwise as-is (it exists so nothing imports a native map module on web).
- Keep the `showsUserLocation` prop — `WalkBoundaryScreen.tsx:140` passes it.
- Missing token → a `Banner`, never a crash (brief §15).

### Remove the old implementation

- `react-native-maps` out of `mobile/package.json` dependencies and out of the `transformIgnorePatterns` allow-list.
- Delete the `jest.mock('react-native-maps', …)` block in `mobile/jest.setup.js`; add a hand-written `@rnmapbox/maps` mock in its place.
- Delete `import type { Region }` + the now-dead region memos, `DEFAULT_DELTA` and `FALLBACK_CENTRE` from `DrawBoundaryScreen.tsx` and `WalkBoundaryScreen.tsx`.
- Remove `GOOGLE_MAPS_ANDROID_API_KEY` from `mobile/.env.example`; add `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` with a comment that it is a public `pk.` token, safe to ship, and should be URL-restricted in the Mapbox console.
- Update the three now-stale Google Maps references in `CLAUDE.md`.

---

## 2. Device GPS — one shared abstraction

New `mobile/src/services/location.ts` — the app has no location abstraction today, just two screens calling expo-location directly. Foreground only; no background permission is requested anywhere.

```ts
export type FieldFix =
  | { state: 'ok'; latitude: number; longitude: number; accuracy: number | null }
  | { state: 'denied' }        // permission refused
  | { state: 'unavailable' }   // location services off / no provider
  | { state: 'timeout' }       // fix did not arrive in time
  | { state: 'failed' };       // anything else
```

- `requestForegroundPermissionsAsync()` → `getCurrentPositionAsync({ accuracy: Accuracy.High })`, raced against an explicit timeout, guarded by a mounted-ref so nothing sets state after unmount.
- `zoomForAccuracy(accuracy)` — field-level zoom scaled by how much the fix can be trusted: good fix (≤ 15 m) → ~17.5, moderate → ~16.5, poor (> 50 m) → ~15.5, unknown accuracy → ~16.5. Never a fixed zoom regardless of accuracy (brief §2), and never a world view.
- `ACCURACY_WARN_METERS` threshold drives the "this position may not be precise enough to place corners" banner (brief §13).
- `WalkBoundaryScreen` keeps `watchPositionAsync` for the walk itself (a one-shot helper cannot serve it) but takes its permission check from here, so the five location states are handled identically in both screens.
- `mobile/jest.setup.js`'s expo-location mock must grow whatever new members this touches (`hasServicesEnabledAsync`, the wider Accuracy enum) and return an accuracy in coords.

---

## 3. Camera behaviour in `DrawBoundaryScreen`

On mount, in priority order:
1. `initialPoints.length >= 3` → fit the camera to the saved boundary's bounds (reuse the existing `bounds()` in `geo.ts`), with padding.
2. Otherwise → request a fix; on `ok`, fly to it at `zoomForAccuracy(accuracy)`.
3. Otherwise → fall back to `initialCentre` at a default field zoom.
4. Otherwise → a banner explaining that precise field location needs location access, and the farmer may still continue manually (brief §2). No world map in any branch.

- The initial move is one-shot, keyed to `mapAttempt`, so panning is never fought (brief §12) but the existing Retry path — which remounts the map via `key={mapAttempt}` — still gets its camera positioned.
- Banner precedence: `no-token` > `map-failed` > `no-location`.
- Undo / Restart / AreaCard / the confirm button are untouched. Vertex editing stays tap-to-add + drag-to-correct.

---

## 4. Persist GPS accuracy

### Migration `supabase/migrations/0005_farm_location_accuracy.sql`

```sql
alter table public.farms
  add column if not exists location_accuracy numeric(8, 2);
```
Follows `0004_farm_location.sql`'s template exactly: nullable, if not exists, no new RLS policy, plus a column comment stating that null means unknown and never 0. `numeric(8,2)` not `(6,2)`.

### Where accuracy is captured — it must be honest per flow:

| Flow | Accuracy stored |
|---|---|
| Walk (`WalkBoundaryScreen`) | Derived from the `watchPositionAsync` fixes that made the polygon — this is the real number |
| Fresh draw | The fix used to centre the map |
| Edit an existing boundary | Preserve the stored value (`accuracy ?? farm.location_accuracy`) |

### Threading:
- `EditBoundary` → `ConfirmEdit` → `ConfirmFieldScreen` → `saveBoundary(points, name, accuracy)`
- `RegisterLand(walk)` → `RegisterBoundary` → `RegisterCropInfo` → `RegisterCropScreen:73` → `saveBoundary(points, name, accuracy)`
- Update `navigation/types.ts`, `MainNavigator.tsx`, `WalkBoundaryScreen`, `DrawBoundaryScreen`, `ConfirmFieldScreen`, `RegisterCropScreen`.

### Backend:
- `schemas/farm.schema.ts` — `location_accuracy: z.number().nonnegative().nullish()` on both schemas. Keep `.strict()`.
- `services/farms.service.ts` — appended in `verifiedValues()` outside `check.values`.
- `undefined` = leave unchanged, `null` = explicitly clear.
- `normalise()` in both `backend/src/services/farms.service.ts` and `mobile/src/services/farms.ts` must coerce it null-guarded.
- Types updated together in one commit: `backend/src/types/domain.ts`, `mobile/src/services/database.types.ts`, `mobile/src/services/farms.ts` (`SaveFarmInput`), `mobile/src/features/farm/FarmContext.tsx` (`saveBoundary` signature).

---

## 5. Weather by field coordinate, fetched on demand

Grid cell = 0.25°, because that is ERA5's own resolution. Snapping the farm centroid to that grid means:
- one stored row per cell the provider actually resolves — no false precision;
- closes a privacy hole (`weather` is world-readable to authenticated users, 0.25° is ~750 km² public geography).

### Migration `supabase/migrations/0006_weather_by_grid_cell.sql`
- add `grid_lat numeric(9,6), grid_lng numeric(9,6)`;
- delete legacy rows (re-derivable observation data with no farmer content);
- set columns not null, drop `weather_unique_observation`, add `unique (grid_lat, grid_lng, observed_on)`, new index;
- `district`/`state` become nullable and stay as descriptive columns.

### `backend/src/controllers/reference.controller.ts::weather`:
```
farmId → getFarm (ownership, 404) → centroid → snap to 0.25° grid
      → fresh row in that cell?  yes → return
                                 no  → Open-Meteo archive @ cell centre
                                     → normalizeWeatherResponse  (existing, untouched)
                                     → upsert                    (admin client)
                                     → return
      → still nothing → 503 SERVICE_NOT_CONNECTED   (unchanged contract)
```
- In-flight dedupe + a negative-result floor (module-level maps keyed by cell).
- `backend/src/ingestion/weather/weatherIngestion.ts` — re-key from district to per-farm-grid-cell.
- `backend/src/ai/context.service.ts` + `ai/prompt.ts` updated to reference field coordinates / grid cell weather.

---

## 6. Home weather card

- `HomeScreen.tsx` keeps inline `<StatusCard testID="weather-card">` in 2×2 grid.
- States:
  - `loading` → "Loading…"
  - `have a reading` → "29°C" + "Observed {{date}}"
  - `nothing` → "Weather data unavailable", muted
- New i18n keys in `en.json` and `hi.json`.

---

## 7. Area calculation

No change. `mobile/src/utils/geo.ts` and `backend/src/utils/geo.ts` both already use `@turf/area` (geodesic WGS84).

---

## Files

### Created
- `supabase/migrations/0005_farm_location_accuracy.sql`
- `supabase/migrations/0006_weather_by_grid_cell.sql`
- `mobile/src/services/location.ts` (+ `location.test.ts`)
- `mobile/src/components/farm/BoundaryMap.types.ts`

### Modified
- `mobile`: `package.json`, `app.config.ts`, `eas.json`, `jest.setup.js`, `.env.example`, `src/components/farm/BoundaryMap.tsx`, `BoundaryMap.web.tsx`, `src/screens/onboarding/DrawBoundaryScreen.tsx`, `FieldLocationScreen.tsx`, `ConfirmFieldScreen.tsx`, `src/screens/farm/WalkBoundaryScreen.tsx`, `RegisterCropScreen.tsx`, `src/screens/home/HomeScreen.tsx`, `src/navigation/types.ts`, `MainNavigator.tsx`, `src/features/farm/FarmContext.tsx`, `src/services/farms.ts`, `agronomy.ts`, `database.types.ts`, `src/utils/geo.ts`, `src/i18n/locales/{en,hi}.json`, `src/test-utils.tsx`
- `backend`: `src/schemas/farm.schema.ts`, `src/services/farms.service.ts`, `src/services/reference.service.ts`, `src/controllers/reference.controller.ts`, `src/types/domain.ts`, `src/ingestion/weather/weatherIngestion.ts`, `src/ai/context.service.ts`, `src/ai/prompt.ts`
- `docs`: `CLAUDE.md`, `README.md`, `docs/PHASE2_5_NOTES.md`
