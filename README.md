# KrishiNetra App

KrishiNetra is an AI-powered smart farming and agricultural market intelligence platform leveraging Sentinel-1 SAR and Sentinel-2 optical Earth observation satellite data, weather intelligence, machine learning, and multilingual Voice AI assistance. It provides field-level crop classification, soil moisture estimation, irrigation scheduling, agricultural advisory, and market-linkage price discovery for farmers.

---

## Repository Layout

```
mobile/       React Native (Expo) app        ← Phase 1, implemented
backend/      Node.js + Express API           ← Phase 2, implemented
ml/           ML service contracts            ← Phase 3, in progress
supabase/     SQL migrations
docs/         PRD, TRD, implementation plan, design assets
```

## Current Status — Phase 2.5

Phase 2 put a Node/Express API between the app and Supabase. The app no longer
queries Supabase tables directly: every farm and profile read/write goes through
the API, which verifies the farmer's Supabase JWT and forwards it so Row Level
Security applies as that farmer.

Phase 2.5 stage a filled the data tables Phase 2 created and left empty. Real
mandi prices come from data.gov.in AGMARKNET and real observed weather from
Open-Meteo, both ingested server-side; Home now shows the farmer's crop, its
Minimum Support Price, and a real temperature for their district.

Where a source has nothing, the API still says so rather than returning a
number it invented — and the tiles that have no source at all (growth stage,
predicted price, sell/wait) keep their empty states until Phase 3.

Stage b turned the Phase 1 avatar UI into a working assistant: the farmer holds
the mic, Sarvam AI transcribes what they said, Google Gemini answers from their
own field records, and a deterministic controller animates the avatar. The model
is told exactly which facts it has and required to say a service is not
connected rather than invent one.

See [docs/PHASE2_5_NOTES.md](docs/PHASE2_5_NOTES.md) for what was built, the
deviations, and where stage b attaches.

### Phase 1

Phase 1 covers the first working farmer journey and the complete AI Farmer Avatar interface:

```
Register → Login → Field location → Draw boundary → Confirm → Home
                                                              └→ AI Avatar
```

- **Implemented**: Supabase email/password auth, session persistence, protected navigation, satellite-map boundary drawing with geodesic area calculation, and saving the farm to an RLS-protected Postgres table.
- **Phase Roadmap**: Crop health, growth stage, weather, mandi prices, price prediction, selling recommendations, buyers, lots, offers, logistics, and payments. The AI Farmer Avatar interface is set up with a scripted interactive preview.

See [docs/PHASE1_NOTES.md](docs/PHASE1_NOTES.md) for the full real-vs-deferred breakdown and architecture notes.

## Getting Started

### 1. Prerequisites

- Node.js 20+
- A physical Android device or emulator (Android 8+)
- Android Studio (for SDK & platform tools)
- A Supabase project
- A Google Cloud project with the **Maps SDK for Android** enabled

### 2. Supabase Setup

Create a Supabase project, then in the SQL editor run:

```sql
supabase/migrations/0001_phase1_schema.sql
supabase/migrations/0002_phase2_schema.sql
supabase/migrations/0003_seed_reference_data.sql
```

`0001` creates `profiles` and `farms`, their triggers, and Row Level Security
(RLS) policies. `0002` adds `crops`, `farm_crops`, `mandis`, `market_prices`,
`msp` and `weather`. `0003` seeds the crop catalogue, the Rajasthan mandi list
and the published wheat MSP — it is idempotent, so re-running it is safe.

Under **Authentication → Providers → Email**:
- Enable email/password.
- Turn off "Confirm email" for Phase 1 development.

### 3. Google Maps Key

Create an Android-restricted API key and restrict it to package `com.krishinetra.app` plus your signing SHA-1. Ensure billing is enabled on Google Cloud.

### 4. Environment Variables

```bash
cd mobile
cp .env.example .env
```

Fill in `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
`EXPO_PUBLIC_API_URL` and `GOOGLE_MAPS_ANDROID_API_KEY`. (`.env` is gitignored.)

On an Android emulator the host machine is reachable at `10.0.2.2`, not
`localhost`, so `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`. On a physical device
use the host's LAN address.

```bash
cd backend
cp .env.example .env
```

Fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. The
service-role key belongs **only** here — never under `mobile/`.

### 5. Run the Backend

```bash
cd backend
npm install
npm run dev          # http://localhost:4000
curl http://localhost:4000/health
```

### 6. Run the Mobile App

```bash
cd mobile
npm install
npm run android      # builds dev client and runs on device/emulator
```

The app needs the backend running: farm and profile data travels through it.

## Scripts

Run from `mobile/`:

| Command | What it does |
|---|---|
| `npm run android` | Build and run on a connected Android device |
| `npm start` | Start the Metro dev server against an installed dev client |
| `npm test` | Run the Jest test suite (141 tests) |
| `npm run typecheck` | Run TypeScript check (`tsc --noEmit`) |

Run from `backend/`:

| Command | What it does |
|---|---|
| `npm run dev` | Start the API in watch mode |
| `npm run build` | Compile to `dist/` |
| `npm test` | Run the Jest + supertest suite (51 tests) |
| `npm run typecheck` | Run TypeScript check (`tsc --noEmit`) |

## Documentation

| Document | Purpose |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product vision, users, scope, user journey |
| [docs/TRD.md](docs/TRD.md) | Architecture, stack, schema, phase requirements |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | The 5-phase roadmap and scope boundaries |
| [docs/PHASE1_NOTES.md](docs/PHASE1_NOTES.md) | What Phase 1 built, and where Phases 2–5 attach |
| [docs/PHASE2_IMPLEMENTATION.md](docs/PHASE2_IMPLEMENTATION.md) | The Phase 2 plan |
| [docs/PHASE2_NOTES.md](docs/PHASE2_NOTES.md) | What Phase 2 built, the deviations, and where Phase 3 attaches |
| [docs/IMPLEMENTATION_PHASE2_5.md](docs/IMPLEMENTATION_PHASE2_5.md) | The Phase 2.5 plan |
| [docs/PHASE2_5_NOTES.md](docs/PHASE2_5_NOTES.md) | What Phase 2.5 built, the deviations, and where Phase 3 attaches |
| [backend/README.md](backend/README.md) | API setup, endpoints, and the auth model |
| `docs/ui-designs/ui-designs.zip` | The design canvas the UI is built from |
| `docs/images/hero_image.png` | The farmer avatar assets |

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | UI + Auth + Farm mapping + Avatar UI | **Done** |
| 2 | Node/Express backend + agricultural data | **Done** |
| 2.5 | Real market + weather data, avatar intelligence V1 | **Done** |
| 3 | ML integration + market intelligence | Planned |
| 4 | Market linkage + transactions | Planned |
| 5 | AI Farmer Avatar intelligence (STT/LLM/TTS, ~22 languages) | Planned |



