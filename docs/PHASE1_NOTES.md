# Phase 1 — build notes

What was actually built, what was deliberately left empty, and where each later
phase attaches. Written for whoever picks up Phase 2.

---

## 1. What is real

These surfaces are backed by live data and work end to end:

| Feature | Where |
|---|---|
| Email/password registration and login | `src/features/auth/AuthContext.tsx`, `src/screens/auth/` |
| Session persistence across app restarts | `src/services/sessionStorage.ts` |
| Protected navigation (auth → onboarding → main) | `src/navigation/RootNavigator.tsx` |
| Satellite map, tap to add corners, drag to correct | `src/components/farm/BoundaryMap.tsx` |
| Geodesic area in m² / acres / hectares | `src/utils/geo.ts` |
| Saving the farm to Supabase under RLS | `src/services/farms.ts`, `supabase/migrations/0001_phase1_schema.sql` |
| Home greeting, field name, area, boundary thumbnail | `src/screens/home/HomeScreen.tsx` |
| Editing an existing boundary | `MainNavigator` → `EditBoundary` / `ConfirmEdit` |
| Language switching (English / Hindi) | `src/features/language/LanguageContext.tsx` |
| Complete avatar UI, all five states | `src/components/avatar/`, `src/features/avatar/` |

## 2. What is deliberately empty

IMPLEMENTATION.md rule 13 forbids presenting mock data as real. Every surface
below therefore renders its **designed layout** in a "not available yet" state,
never a plausible sample number:

| Surface | State in Phase 1 | Arrives in |
|---|---|---|
| Growth stage, Weather tiles (Home) | `—` + "Available in a future update" | Phase 2/3 |
| Home advisory banner | Not rendered — it is conditional by design and there is no condition | Phase 3 |
| Market summary card (Home) | `—` + "Market prices are not connected yet" | Phase 2/3 |
| Field analysis rows | `—` + an explanatory empty state | Phase 3 |
| Market screen price/MSP/trend/recommendation | `—` + an explanatory empty state | Phase 3 |
| History timeline | The designed empty state | Phase 3 |
| Profile → Notifications, Help | Visible but disabled | Phase 2+ |
| Avatar answers about crop, mandi, sell, weather | Says plainly that the service is not connected | Phase 5 |

The one avatar answer that is real is **"How big is my field?"** — it reads the
farmer's own saved acreage and carries a "From your field record" source chip.

## 3. Deviations from the plan, and why

**Session storage is `expo-secure-store`, not AsyncStorage.** Supabase's own
React Native docs use AsyncStorage, which stores JWTs in plaintext.
`src/services/sessionStorage.ts` wraps SecureStore (Android
EncryptedSharedPreferences / iOS Keychain) with a chunking layer, because
SecureStore warns above ~2 KB per value and a populated Supabase session exceeds
that.

**Fonts are required by file path, not from the package root.** Importing
`@expo-google-fonts/archivo` pulls all nine weights of both families into the
bundle — about 3 MB, most never rendered. `App.tsx` requires only the three
weights the type scale uses.

**The `farms.boundary` column is JSONB GeoJSON, not PostGIS.** Phase 1 runs no
spatial queries. PostGIS can be added later as a generated column with no data
migration.

**A `profiles` table exists**, though IMPLEMENTATION.md §6 lists it as optional.
It is needed for the Home greeting and the language preference, and it is where
Phase 2's farmer APIs will hang.

## 4. Design decisions taken from the prototype

`docs/ui-designs/ui-designs.zip` contains two artifacts that disagree. The
clickable prototype (`Farmer App.dc.html`) is newer than the written spec
(`uploads/design.md`) and wins on three points:

1. **Square corners**, not `design.md`'s 12dp radius. Only the FAB and status
   dots are round.
2. **Archivo + Noto Sans Devanagari**, not system Roboto.
3. **Soil moisture and irrigation are gone app-wide** — the Home status grid is
   Growth stage + Weather. The prototype's own notes record this removal.

Two further conflicts were resolved in favour of the project documentation:

- `design.md` specifies **phone + OTP** auth. The PRD/TRD require Supabase
  email/password, so Login and Register were newly designed in the established
  visual language. Phone auth remains available for a later phase.
- `design.md` opens by declaring itself an independent Flutter app that "is not
  a copy of KrishiNetra". It is used purely as the visual system; the product,
  scope and stack come from the PRD/TRD/IMPLEMENTATION docs.

## 5. Where the later phases attach

**Phase 2 (backend).** No screen imports `supabase` directly — every read and
write goes through `src/services/farms.ts` and `src/services/profiles.ts`.
Replacing those two modules' bodies with `fetch` calls to the Express API is the
whole client-side change. `src/services/errors.ts` already normalises failures
into translation keys, so error handling does not move.

**Phase 3 (ML / market intelligence).** The empty surfaces listed in §2 keep
their real layout, so connecting them is a matter of feeding them data. TRD §23
still applies: when a prediction fails, show that it is unavailable — never a
fabricated number.

**Phase 5 (avatar intelligence).** `src/features/avatar/avatarMachine.ts` is a
pure reducer with no timers, audio or networking in it. The scripted driver
lives entirely in `AvatarContext.tsx` and `demoScript.ts`. Phase 5 replaces the
driver — speech-to-text dispatches `START_LISTENING` / `STOP_LISTENING`, the
agent dispatches `RESOLVE` or `FAIL`, text-to-speech dispatches `DONE` — and no
avatar component changes. The header's "Demo preview" subtitle and the footer's
preview notice should be removed at the same time.

## 6. Testing

119 tests across 8 suites (`npm test`):

- `src/utils/geo.test.ts` — area, centroid, GeoJSON ordering, unit conversion,
  thumbnail projection. Includes an explicit check that the area is geodesic
  rather than planar, since a planar shoelace overstates a Karnal-latitude plot
  by roughly 15%.
- `src/features/avatar/avatarMachine.test.ts` — every transition, including the
  ignored ones and the error→retry path.
- `src/services/errors.test.ts` — Supabase error mapping, including that raw
  internal messages never reach the farmer.
- `src/screens/auth/validation.test.ts`, `LoginScreen.test.tsx` — validation and
  auth failure copy.
- `src/screens/onboarding/DrawBoundaryScreen.test.tsx` — the ≥3-corner rule and
  the live area readout.
- `src/screens/home/HomeScreen.test.tsx` — real values render, and the
  prototype's sample figures explicitly do not.
- `src/components/avatar/AvatarOverlay.test.tsx` — all five states plus the
  preview labelling.

Still to verify by hand, because they need a device and a live project:

- RLS: sign in as a second account and confirm the first account's farm is
  invisible.
- Session persistence across a cold app restart.
- Area accuracy against a plot of known size (cross-check in geojson.io or
  Google Earth's measure tool).
- Satellite tiles rendering with a real, correctly restricted Maps key.
