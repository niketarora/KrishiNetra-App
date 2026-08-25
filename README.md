# KrishiNetra App

KrishiNetra is an AI-powered smart farming and agricultural market intelligence platform leveraging Sentinel-1 SAR and Sentinel-2 optical Earth observation satellite data, weather intelligence, machine learning, and multilingual Voice AI assistance. It provides field-level crop classification, soil moisture estimation, irrigation scheduling, agricultural advisory, and market-linkage price discovery for farmers.

---

## Repository Layout

```
mobile/       React Native (Expo) app        ← Phase 1, implemented
backend/      Node.js + Express API           ← Phase 2, not started
ml/           ML service contracts            ← Phase 3, not started
supabase/     SQL migrations
docs/         PRD, TRD, implementation plan, design assets
```

## Current Status — Phase 1

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
```

This creates `profiles` and `farms`, their triggers, and Row Level Security (RLS) policies.

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

Fill in `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `GOOGLE_MAPS_ANDROID_API_KEY`. (`.env` is gitignored).

### 5. Run the Mobile App

```bash
cd mobile
npm install
npm run android      # builds dev client and runs on device/emulator
```

## Scripts

| Command | What it does |
|---|---|
| `npm run android` | Build and run on a connected Android device |
| `npm start` | Start the Metro dev server against an installed dev client |
| `npm test` | Run the Jest test suite |
| `npm run typecheck` | Run TypeScript check (`tsc --noEmit`) |

## Documentation

| Document | Purpose |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product vision, users, scope, user journey |
| [docs/TRD.md](docs/TRD.md) | Architecture, stack, schema, phase requirements |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | The 5-phase roadmap and scope boundaries |
| [docs/PHASE1_NOTES.md](docs/PHASE1_NOTES.md) | What Phase 1 built, and where Phases 2–5 attach |
| `docs/ui-designs/ui-designs.zip` | The design canvas the UI is built from |
| `docs/images/hero_image.png` | The farmer avatar assets |

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | UI + Auth + Farm mapping + Avatar UI | **Done** |
| 2 | Node/Express backend + agricultural data | In progress / Up next |
| 3 | ML integration + market intelligence | Planned |
| 4 | Market linkage + transactions | Planned |
| 5 | AI Farmer Avatar intelligence (STT/LLM/TTS, ~22 languages) | Planned |
