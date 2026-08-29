# CLAUDE.md

Guidance for Claude Code (and future contributors) working in this repository.

## Project Purpose

KrishiNetra is an AI-powered smart farming and agricultural market intelligence
platform. It combines Sentinel-1 SAR / Sentinel-2 optical Earth-observation
satellite data, weather intelligence, machine learning, and a multilingual
Voice AI assistant to give Indian farmers field-level crop classification,
soil moisture estimation, irrigation scheduling, agricultural advisory, and
market-linkage price discovery.

The product is being built in phases (see **Current Development Workflow**
below). As of this writing the repo is at **Phase 2.5**: Phase 1 (UI + auth +
farm mapping) and Phase 2 (Node/Express API + agricultural data) are done;
Phase 2.5 added real mandi-price/weather ingestion and a working voice
avatar. Phases 3–5 (ML integration, market linkage/transactions, full avatar
intelligence) are planned but not yet built — do not assume their
functionality exists.

## Repository Layout

```
mobile/       React Native (Expo) app         — Phase 1, implemented
backend/      Node.js + Express API            — Phase 2, implemented
ml/           ML service contracts             — Phase 3, in progress (docs/contracts only, see ml/README.md)
supabase/     SQL migrations (Postgres schema + RLS policies)
docs/         PRD, TRD, phase implementation plans/notes, design assets
```

There is no root `package.json` with real scripts — `mobile/` and `backend/`
are independent Node projects, each with their own `package.json`,
`node_modules/`, and `.env`. Always `cd` into the relevant one before running
npm commands.

## Frontend / Mobile Architecture (`mobile/`)

- **Framework**: Expo (SDK ~57) + React Native 0.86, React 19, TypeScript
  (strict mode). Entry point: [mobile/index.ts](mobile/index.ts) →
  [mobile/App.tsx](mobile/App.tsx).
- **Path alias**: `@/*` → `mobile/src/*` (configured in
  [tsconfig.json](mobile/tsconfig.json) and mirrored in Jest's
  `moduleNameMapper`).
- **State/providers** (mounted in `App.tsx`, in this order): `AuthProvider` →
  `LanguageProvider` → `RootNavigator`, with `FarmProvider` and
  `AvatarProvider` mounted once a session exists (see Navigation below).
- **`mobile/src/` structure**:
  - `screens/` — one folder per feature area: `auth/`, `onboarding/`,
    `home/`, `field/`, `market/`, `history/`, `profile/`, plus
    top-level `SplashScreen.tsx`.
  - `features/` — cross-screen logic and React Context: `auth/`
    (`AuthContext`), `farm/` (`FarmContext`), `avatar/` (`AvatarContext`,
    the avatar state machine, voice recorder/player hooks), `language/`
    (`LanguageContext`), `demo/` (demo-mode sample-data logic).
  - `components/` — presentational components: `ui/` (design-system
    primitives: `Button`, `Card`, `Input`, `Badge`, `Banner`, `Skeleton`,
    `StatusCard`, `Text`, `Icon`, …, re-exported from
    [components/ui/index.ts](mobile/src/components/ui/index.ts)),
    `farm/` (map/boundary widgets), `avatar/` (avatar UI incl. `avatar3d/`
    and `animation/` subfolders).
  - `navigation/` — see **Navigation Structure** below.
  - `services/` — the only layer allowed to talk to Supabase or the
    backend API: `supabase.ts` (the single Supabase client),
    `api.ts` (fetch wrapper to the backend), `farms.ts`, `profiles.ts`,
    `avatarService.ts`, `agronomy.ts`, `errors.ts`, `sessionStorage.ts`,
    `database.types.ts` (generated Supabase types).
  - `theme/` — design tokens: `colors.ts`, `typography.ts`, `spacing.ts`,
    re-exported via `theme/index.ts`.
  - `i18n/` — i18next setup + `locales/en.json`, `locales/hi.json`
    (English and Hindi).
  - `utils/` — small pure helpers (`geo.ts` for GeoJSON↔points, `format.ts`).
- **Fonts**: only specific weights of Archivo and Noto Sans Devanagari are
  imported by exact file path in `App.tsx` (not the package root) to avoid
  pulling in ~3 MB of unused font weights — follow this pattern if adding
  fonts.
- **Testing**: Jest via `jest-expo` preset + `@testing-library/react-native`.
  Test files live next to the code they test (`*.test.ts` / `*.test.tsx`
  under `src/`).

## Backend Architecture (`backend/`)

- **Framework**: Node.js (>=20) + Express 5, TypeScript, ESM (`"type":
  "module"` — all relative imports use `.js` extensions even in `.ts`
  source, per Node ESM resolution rules). Dev server via `tsx watch`.
- **Purpose**: the layer between the mobile app and Supabase. Since Phase 2,
  the app **no longer queries Supabase tables directly** for farm/profile
  data — every such read/write goes through this API, which verifies the
  farmer's Supabase JWT (`requireAuth` middleware) and forwards it to
  Supabase so Row Level Security (RLS) applies as that farmer. The
  Supabase **service-role key** (which bypasses RLS) is used server-side
  only, and only for reference-data writes — never on a path that returns
  farmer-owned rows.
- **`backend/src/` structure**:
  - `app.ts` — builds the Express app (helmet, CORS, JSON body limit
    256kb, `/health` liveness check, rate limiting on `/api/v1`,
    `notFound`/`errorHandler` at the end). Built as a factory function so
    tests can mount it with `supertest` without opening a real listener.
  - `server.ts` — starts the HTTP listener using the app from `app.ts`.
  - `routes/index.ts` — the single `apiRouter`, mounted at `/api/v1` and
    gated entirely behind `requireAuth` (except `/health`, mounted
    separately in `app.ts` so it answers without a token). Routes for
    farmers, farms, farm crops, reference data (crops/mandis/MSP/market
    prices/weather), and the AI avatar (`/ai/transcribe`, `/ai/chat`,
    `/ai/speak`). Route prefixes reserved for later phases (`/buyers`,
    `/lots`, `/offers`, `/predictions`, `/recommendations`, etc., per TRD
    §14) are **deliberately not mounted** — they fall through to
    `notFound` rather than being stubbed. Don't add stub routes for them;
    build them when their phase arrives.
  - `controllers/` — one per resource (`farmers`, `farms`, `farmCrops`,
    `reference`, `ai`), thin — validate via middleware, delegate to
    `services/`.
  - `services/` — the Supabase-calling business logic (`farms.service.ts`,
    `farmCrops.service.ts`, `profiles.service.ts`, `reference.service.ts`).
  - `ai/` — the avatar's backend: `stt.service.ts` (Sarvam speech-to-text),
    `llm.service.ts` (Google Gemini via `@google/genai`), `tts.service.ts`
    (Sarvam text-to-speech), `context.service.ts` (assembles the farmer's
    real data into the LLM prompt), `prompt.ts`. The model is instructed
    to say a service is "not connected" rather than invent data it
    wasn't given.
  - `ingestion/` — server-side data ingestion scripts' logic:
    `market/` (data.gov.in AGMARKNET mandi prices), `weather/`
    (Open-Meteo), `geocode/` (Nominatim reverse geocoding). Invoked via
    `npm run ingest:market` / `npm run ingest:weather` (see
    `package.json` scripts), not on any request path.
  - `middleware/` — `requireAuth` (verifies the Supabase JWT),
    `validate` (Zod schema validation for body/query/params),
    `requestLogger`, `errorHandler`, `notFound`.
  - `schemas/` — Zod schemas per resource, used by `validate` middleware.
  - `config/` — `env.ts` (Zod-validated environment, see below),
    `supabase.ts` (Supabase client construction).
  - `scripts/` — one-off/dev scripts run via `tsx`:
    `seedDemoFarmer.ts`, `ingestMarket.ts`, `ingestWeather.ts`.
  - `types/domain.ts` — shared domain types.
  - `utils/` — `ApiError.ts`, `apiResponse.ts` (the response envelope
    helper), `geo.ts`, `wav.ts`.
- **API response envelope** (TRD §15), returned by every endpoint:
  ```ts
  { success: true, data: T, message?: string }
  | { success: false, error: { code: string, message: string } }
  ```
  The mobile app's `services/api.ts` unwraps this and turns any failure
  (transport, timeout, non-2xx, or `success: false`) into a `DataError`
  carrying a translation key.
- **Testing**: Jest + `ts-jest` + `supertest`, run with
  `NODE_OPTIONS=--experimental-vm-modules` (see `package.json`) because the
  backend is ESM. Test files sit next to the code they test
  (`*.test.ts`).

## Navigation Structure (`mobile/src/navigation/`)

Root gating happens in [RootNavigator.tsx](mobile/src/navigation/RootNavigator.tsx),
which decides which of three worlds the farmer is in **by state, not
imperative navigation** — there is no route to the main app while there is no
session, so a signed-out user cannot reach it by any navigation action:

```
RootNavigator
├─ (no session)              → AuthNavigator (Login, Register)
└─ (session exists)
   └─ FarmProvider + AvatarProvider
      ├─ (no farm yet)       → OnboardingNavigator
      │                          FieldLocation → DrawBoundary → ConfirmField
      │                          (saving a farm flips this to MainNavigator)
      └─ (farm exists)       → MainNavigator
                                 Tabs: Home | Field | Market | History
                                 + pushed screens: Profile, EditBoundary,
                                   ConfirmEdit (boundary re-edit flow)
      + AvatarOverlay rendered OUTSIDE NavigationContainer
        (an interaction layer over the whole app, not a route)
```

- `AuthNavigator` — native-stack, `Login` / `Register`.
- `OnboardingNavigator` — native-stack, first-run field setup only; reached
  only when signed in but with no farm yet. No screen here navigates to
  Home directly — saving a farm updates `FarmProvider`'s state, which is
  what causes `RootNavigator` to swap the whole navigator over.
- `MainNavigator` — native-stack wrapping a bottom-tab navigator
  (`MainTabs`: Home, Field, Market, History) plus pushed screens `Profile`
  and the boundary-editing flow (`EditBoundary` → `ConfirmEdit`).
- Param types for all stacks/tabs live in
  [navigation/types.ts](mobile/src/navigation/types.ts).

## Important Directories and Files

| Path | What it is |
|---|---|
| [mobile/App.tsx](mobile/App.tsx) | App entry, provider tree, font loading |
| [mobile/app.config.ts](mobile/app.config.ts) | Expo config as TS (app id, permissions, plugins, Google Maps key wiring) |
| [mobile/src/navigation/](mobile/src/navigation/) | All navigators + shared param types |
| [mobile/src/services/api.ts](mobile/src/services/api.ts) | The only way screens reach the backend |
| [mobile/src/services/supabase.ts](mobile/src/services/supabase.ts) | The **only** Supabase client in the app — screens must never import it directly; only auth and `getAccessToken()` use it |
| [backend/src/app.ts](backend/src/app.ts) / [server.ts](backend/src/server.ts) | Express app factory / listener |
| [backend/src/routes/index.ts](backend/src/routes/index.ts) | All API routes, single source of truth for what's mounted |
| [backend/src/config/env.ts](backend/src/config/env.ts) | Zod-validated env — **the authoritative list of what the backend needs** |
| [supabase/migrations/](supabase/migrations/) | SQL schema/RLS, run in order in the Supabase SQL editor |
| [backend/README.md](backend/README.md) | API setup, endpoint list, auth model detail |
| [docs/TRD.md](docs/TRD.md) | Architecture, stack, schema, phase requirements (referenced throughout code comments as "TRD §n") |
| [docs/PRD.md](docs/PRD.md) | Product vision, users, scope, user journey |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | 5-phase roadmap and scope boundaries |
| `docs/PHASE*_NOTES.md` | What each completed phase actually built, deviations from plan, where the next phase attaches — **read the notes for the current phase before extending that area** |
| `mobile/AGENTS.md` | ⚠️ States Expo has changed recently — read https://docs.expo.dev/versions/v57.0.0/ for exact current-version docs before writing Expo code. `mobile/CLAUDE.md` (`@AGENTS.md`) pulls this file in automatically. |

## Supabase / Backend Integration

- **Auth**: sign-up/sign-in/sign-out go straight from the mobile app to
  Supabase Auth. The resulting Supabase session/JWT is what `services/api.ts`
  attaches as a Bearer token on every backend call. As of the farmer-identity
  foundation stage, the farmer-facing flow is **phone-first**: Phone → demo
  OTP → authenticated Supabase user (`screens/auth/PhoneEntryScreen.tsx` →
  `OtpVerifyScreen.tsx`). Since Supabase Phone Auth needs a paid SMS provider
  this prototype does not configure, `features/auth/demoOtp.ts` generates and
  verifies a local, in-memory OTP (shown on screen, never persisted or SMSed),
  and `features/auth/phoneIdentity.ts` bridges a verified phone number to a
  real `auth.users` row via a synthetic email + device-local password — see
  both files' header comments for the swap path to real Supabase Phone OTP.
  The original email/password `LoginScreen`/`RegisterScreen` still exist
  (unit-tested) but are no longer wired into `AuthNavigator`.
- **Data access**: since Phase 2, farm and profile data flows
  `mobile → backend (Express) → Supabase`, never `mobile → Supabase`
  directly. The backend forwards the farmer's JWT so Postgres RLS applies
  as that farmer; the service-role key (which bypasses RLS) is used
  backend-side only, for reference-data writes.
- **Schema** (`supabase/migrations/`, run in order):
  - `0001_phase1_schema.sql` — `profiles`, `farms`, triggers, RLS.
  - `0002_phase2_schema.sql` — `crops`, `farm_crops`, `mandis`,
    `market_prices`, `msp`, `weather`.
  - `0003_seed_reference_data.sql` — seeds crop catalogue, Rajasthan mandi
    list, published wheat MSP. Idempotent — safe to re-run.
  - `0004_farm_location.sql` — present in the repo but **not yet listed in
    the top-level README's setup steps**; check its contents before
    assuming it's applied on an existing Supabase project, and update the
    README if you rely on it.
  - `0005_farmer_identity.sql` — adds `profiles.email` (optional, distinct
    from the demo-OTP bridge's synthetic auth email), a `FarmerLocation`
    (`location_latitude/longitude/city/district/state/country/source`,
    seeded to a Pratapgarh, Rajasthan demo placeholder —
    `location_source: 'demo'|'gps'|'manual'`), and notification preferences
    (`in_app_alerts`/`sms_alerts`/`voice_alerts`, all default `true`). Also
    present in the repo but not yet listed in the README's setup steps.
- **Real data sources wired up in Phase 2.5**: mandi prices from
  data.gov.in AGMARKNET, weather from Open-Meteo — both ingested
  server-side via `npm run ingest:market` / `npm run ingest:weather` in
  `backend/`, not fetched live per-request. Where a source has nothing,
  the API reports that explicitly rather than inventing a number; tiles
  with no source at all yet (growth stage, predicted price, sell/wait)
  keep empty states until Phase 3.
- **Avatar intelligence** (Phase 2.5b): farmer holds the mic →
  `expo-audio` records → Sarvam AI transcribes (`ai/stt.service.ts`) →
  Google Gemini answers using only the farmer's real field records
  assembled by `ai/context.service.ts` → Sarvam speaks the answer back
  (`ai/tts.service.ts`) → a deterministic controller
  (`features/avatar/avatarMachine.ts`) animates the avatar. The model is
  required to say a service isn't connected rather than invent one.

## Environment Variables and Configuration

Two independent `.env` files, **not** a root-level one — each must sit next
to its own `.env.example`:

### `mobile/.env` (copy of [mobile/.env.example](mobile/.env.example))

| Variable | Required? | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | yes | Falls back to a harmless placeholder in code if absent, so the app still boots — but auth will not work |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | Publishable key — safe client-side because every table is RLS-protected |
| `EXPO_PUBLIC_API_URL` | yes | **Device-dependent** — see note below |
| `GOOGLE_MAPS_ANDROID_API_KEY` | yes (for map screens) | Restrict by package `com.krishinetra.app` + signing SHA-1 in Google Cloud Console; billing must be enabled |
| `EXPO_PUBLIC_DEMO_MODE` | no, default `false` | Fills not-yet-built UI surfaces (crop health, growth stage, sell/wait, History timeline) with clearly-marked SAMPLE data. Never enable in a shipped build |
| `EAS_PROJECT_ID` | no | Only for EAS cloud builds |

`EXPO_PUBLIC_API_URL` **must match how the device reaches this machine**:
- Android **emulator** → `http://10.0.2.2:4000` (emulator-only alias for
  the host loopback).
- Physical Android **device** on the same network → the host's actual LAN
  IPv4 address, e.g. `http://192.168.1.20:4000`. `10.0.2.2` does **not**
  resolve on real hardware. Find the LAN IP with `ipconfig` (Windows) /
  `ifconfig`/`ip addr` (macOS/Linux) and update this value when switching
  between emulator and physical-device testing.

Must **never** contain: `SUPABASE_SERVICE_ROLE_KEY`, `ML_SERVICE_SECRET`,
`AI_API_KEY`, or any payment secret.

### `backend/.env` (copy of [backend/.env.example](backend/.env.example))

| Variable | Required? | Notes |
|---|---|---|
| `PORT` | no, default `4000` | |
| `NODE_ENV` | no, default `development` | |
| `SUPABASE_URL` | **yes** | Boot fails without it |
| `SUPABASE_ANON_KEY` | **yes** | Used with the farmer's forwarded JWT so RLS applies |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Bypasses RLS — server-side only, never under `mobile/` |
| `CORS_ORIGINS` | no, default `http://localhost:8081` | Comma-separated; the Expo dev server origin |
| `MARKET_API_KEY` | no | data.gov.in AGMARKNET key. Without it, `npm run ingest:market` stops with a clear message; the server itself still boots and reports market data as "not connected" |
| `MARKET_API_URL`, `WEATHER_API_URL`, `GEOCODE_API_URL` | no | Have working defaults; overridable to point at a local fixture in tests |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | no | Avatar chat backend. Check `config/env.ts` for the currently-authoritative variable name — the `.env.example` template and `env.ts` schema should agree; if they don't, that's drifted and worth flagging |
| `SARVAM_API_KEY` | no | Powers both transcription and speech synthesis |
| `SARVAM_TTS_MODEL`, `SARVAM_TTS_SPEAKER` | no | Have defaults (`bulbul:v2`, `abhilash`) |
| `ML_SERVICE_URL` | no | Declared for Phase 3; unused so far |

The backend validates its environment at boot with a Zod schema
([backend/src/config/env.ts](backend/src/config/env.ts)) and refuses to
start with a message naming any missing required variable, rather than
starting half-configured — **that file is the single source of truth** for
what's actually required vs. optional; prefer it over this document if
they ever disagree.

`.gitignore` at the repo root excludes `.env` and `.env.*` (but not
`.env.example`) globally, so both apps' real env files are already covered
without per-directory ignores.

## How to Install Dependencies

```bash
cd backend && npm install
cd mobile && npm install
```

Each has its own `package-lock.json` — always run `npm install` inside the
specific app directory, never from the repo root (there is no root
`package.json`).

## How to Run the Development App

1. **Backend** (needed first — the app's farm/profile data travels through it):
   ```bash
   cd backend
   npm run dev          # tsx watch, http://localhost:4000
   ```
   Verify it's up: `curl http://localhost:4000/health`.

2. **Mobile**:
   ```bash
   cd mobile
   npm run android      # expo run:android — prebuilds native android/, then Gradle-builds and installs on a connected device/emulator
   ```
   - `mobile/android/` and `mobile/ios/` are **generated by Expo prebuild
     and gitignored** — they don't exist until the first `npm run android`
     (or `npx expo prebuild`) run, and that first run is a full native
     build (JDK + Android SDK required, several minutes). Subsequent runs
     are much faster.
   - Requires `ANDROID_HOME`/`ANDROID_SDK_ROOT` to point at the Android
     SDK and `adb`/`emulator` from `platform-tools`/`emulator` on `PATH`
     (or invoke them by full path) — these aren't set by default in every
     shell on this machine.
   - Also requires a valid `JAVA_HOME` (JDK 17) for the Gradle build.
     **On this machine the system `JAVA_HOME` has been observed pointing
     at a stale/non-existent folder name** (e.g. `...\jdk-17.0.15` when
     the actually-installed folder is `...\jdk-17.0.15.6-hotspot`) —
     Gradle fails immediately with `ERROR: JAVA_HOME is set to an invalid
     directory` if so. Check `$JAVA_HOME` against what's actually under
     `C:\Program Files\Eclipse Adoptium\` (or wherever the JDK is
     installed) before assuming the build is broken.
   - **Physical device**: enable Developer Options → USB debugging, plug
     in via USB, accept the "Allow USB debugging" prompt, confirm with
     `adb devices` (should show `device`, not `unauthorized`). Remember to
     point `EXPO_PUBLIC_API_URL` at the LAN IP, not `10.0.2.2` (see
     Environment Variables above).
   - **Emulator**: `emulator -list-avds` to see available AVDs, `emulator
     -avd <name>` to boot one, then `npm run android` as above.
   - Once a dev client is installed, `npm start` alone starts just the
     Metro bundler against it (faster iteration than a full rebuild).

## How to Run Tests

```bash
cd backend && npm test        # Jest + supertest, 51 tests (ESM: needs NODE_OPTIONS=--experimental-vm-modules, already wired into the npm script)
cd backend && npm run typecheck

cd mobile  && npm test        # Jest via jest-expo preset, 141 tests
cd mobile  && npm run typecheck
```

`npm test -- --watch` (or the `test:watch` script in both) for watch mode.

## Current Development Workflow

The project is built in five documented phases (see `docs/IMPLEMENTATION.md`
and the phase-specific `docs/PHASE*_NOTES.md` files):

| Phase | Scope | Status |
|---|---|---|
| 1 | UI + Auth + Farm mapping + Avatar UI | Done |
| 2 | Node/Express backend + agricultural data | Done |
| 2.5 | Real market + weather data, avatar intelligence V1 | Done |
| 3 | ML integration + market intelligence | Planned |
| 4 | Market linkage + transactions | Planned |
| 5 | AI Farmer Avatar intelligence (STT/LLM/TTS, ~22 languages) | Planned |

Before extending a feature area, read the `PHASE*_NOTES.md` for whichever
phase last touched it — these document what was actually built, deliberate
deviations from the original plan, and exactly where the next phase is
meant to attach. Don't assume a documented plan (`PHASE*_IMPLEMENTATION.md`,
`TRD.md`) was followed to the letter; the `_NOTES.md` files are the record
of what's real.

## Conventions Observed in the Existing Code

- **Comment style**: comments explain *why*, not *what* — especially for
  non-obvious architectural decisions (e.g. why the avatar overlay is
  rendered outside `NavigationContainer`, why fonts are imported by exact
  path, why RootNavigator gates by state instead of imperative
  navigation). Match this density and intent when adding code; don't
  narrate the obvious.
- **Layering is strict and intentional**:
  - Mobile: `screens/` call `services/`, never Supabase or `fetch`
    directly. `services/supabase.ts` is the *only* file that constructs a
    Supabase client. `services/api.ts` is the *only* place that talks to
    the backend.
  - Backend: `controllers/` validate (via `middleware/validate` + Zod
    schemas in `schemas/`) and delegate to `services/`; `services/` hold
    the actual Supabase-calling logic. Don't put Supabase calls in
    controllers.
  - Preserve these seams when adding features — new data access goes
    through the existing service layer, not around it.
- **Never invent data**: both the reference-data endpoints and the AI
  avatar are written to explicitly report "not connected" / show an empty
  state rather than fabricate a value when a real source isn't wired up
  yet. Keep this behavior when extending — a plausible-looking placeholder
  number is treated as worse than an honest gap.
- **Secrets stay server-side**: `SUPABASE_SERVICE_ROLE_KEY` and all AI
  provider keys (`ANTHROPIC_API_KEY`/`GEMINI_API_KEY`, `SARVAM_API_KEY`)
  must only ever appear in `backend/.env`, never under `mobile/` or in any
  `EXPO_PUBLIC_*` variable (those get bundled into the client and are
  effectively public).
- **TypeScript strict mode** everywhere, with the `@/*` → `src/*` path
  alias in `mobile/`. Backend is ESM — relative imports need explicit
  `.js` extensions in source `.ts` files.
- **i18n**: user-facing strings go through `react-i18next` /
  `i18n/locales/{en,hi}.json`, not hardcoded — the login screen is
  already localized before any profile exists to read a language
  preference from (`LanguageProvider` is mounted above the navigator for
  this reason).
- **Demo mode** (`EXPO_PUBLIC_DEMO_MODE`) is a presentation-only escape
  hatch for UI surfaces with no real data source yet — it writes nothing
  and the AI assistant never sees demo values. Keep this separation if
  extending demo mode: it must never leak into real data paths or the
  avatar's context.
- **`mobile/AGENTS.md`** (pulled in by `mobile/CLAUDE.md`) is a standing
  instruction to check the *exact* versioned Expo docs
  (https://docs.expo.dev/versions/v57.0.0/) before writing Expo-related
  code, because Expo's API has changed recently relative to older
  training data. Follow this for any Expo config/plugin/API work.

## Things Future Feature Development Should Know

- **No root `package.json`**: don't add one casually; `mobile/` and
  `backend/` are deliberately independent projects. If a root-level
  orchestration script becomes genuinely useful, discuss the tradeoff
  first rather than assuming a monorepo tool is wanted.
- **`ml/`** currently contains only a README describing service
  *contracts* — there is no running ML service yet. Don't wire up calls
  to it as if it exists.
- **Unmounted route prefixes** in the backend (`/buyers`, `/lots`,
  `/offers`, `/predictions`, `/recommendations`, `/ai` beyond what's
  already there, etc., per TRD §14) are a deliberate signal of what's
  *not* built yet — check `docs/TRD.md` §14 and the routes file itself
  before assuming an endpoint should exist.
- **`docs/PHASE2_5_NOTES.md`** and **`docs/PHASE1_NOTES.md`** contain a
  "real vs. deferred" breakdown per feature — the fastest way to check
  whether something is actually wired to real data or still a
  placeholder/empty-state.
- Migration `0004_farm_location.sql` exists in `supabase/migrations/` but
  isn't mentioned in the top-level `README.md`'s Supabase setup steps —
  read it before assuming a fresh Supabase project matches the current
  schema, and consider updating the README when this is confirmed.
