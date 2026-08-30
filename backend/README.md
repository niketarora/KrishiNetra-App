# backend

The KrishiNetra 2.0 API. Node.js + Express + TypeScript, sitting between the
mobile app and Supabase — and, in later phases, between the app and the ML
services and external agricultural APIs.

Built in Phase 2, extended in Phase 2.5 with real data ingestion and the
avatar's AI endpoints. See `docs/PHASE2_NOTES.md` and `docs/PHASE2_5_NOTES.md`
for what was actually built and why.

## Prerequisites

- Node 20 or newer
- A Supabase project with `supabase/migrations/0001` through `0004` applied

## Setup

```bash
cd backend
npm install
cp .env.example .env    # then fill it in
npm run dev
```

`npm run dev` starts on `http://localhost:4000` with reload. The environment is
validated at boot: a missing variable stops the process with a message naming
it, rather than failing later on a farmer's request.

```bash
curl http://localhost:4000/health
```

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Watch mode via tsx |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest + supertest |
| `npm run seed:demo` | Create the demo farmer (development only) |
| `npm run demo:full` | Seed the demo farmer, then ingest real prices and weather |
| `npm run ingest:market` | Pull real mandi prices from data.gov.in |
| `npm run ingest:weather` | Pull observed weather from Open-Meteo |

## Ingesting real data

Two scripts fill the reference tables Phase 2 created and left empty:

```bash
npm run ingest:market     # data.gov.in AGMARKNET daily mandi prices
npm run ingest:weather    # Open-Meteo observed daily weather
```

`ingest:market` needs `MARKET_API_KEY` (register free at https://data.gov.in).
It defaults to Rajasthan wheat, which is what the seeded reference data covers;
`-- --state X --commodity Y` overrides that.

`ingest:weather` needs no key. It fetches one district per farm that has
resolved a district, using that farm's centroid as the sample point — the
`mandis` table has no coordinates, and inventing one is not an option.

Both scripts are idempotent (they upsert on the unique constraints in `0002`)
and both print what they refused to write and why. A skipped row is never a
silently patched row: a missing provider value stays null, a record with an
invalid price range is dropped, and an unrecognised mandi is reported rather
than created. If the provider is unavailable, nothing is written and the API
keeps reporting the data as not connected.

## The avatar's AI endpoints

```
POST /api/v1/ai/transcribe    multipart `audio` -> { text, language }
POST /api/v1/ai/chat          { messages, language } -> { text, model }
```

Both need a key in `.env`, and both report themselves as not connected rather
than crashing when one is missing:

| Concern | Provider | Variable |
|---|---|---|
| Speech to text | Sarvam AI | `SARVAM_API_KEY` |
| Language model | Google Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` |

Both keys are server-side only. The app uploads audio and text and gets text
back; it never learns which provider answered, which is what lets Phase 5
replace either one behind the same two routes.

`src/ai/prompt.ts` is the safety control for this feature and is tested like
one. It tells the model exactly which facts it has — each with its source and
date — and requires it to say the service is not connected for anything it
cannot retrieve: predictions, sell/wait advice, buyers, offers, payments.
`src/ai/context.service.ts` assembles those facts through the caller's own
token, so RLS scopes them exactly as it does everywhere else. That is not tool
calling; it is the same data the Home screen already shows.

## How a farm gets a district

`weather` is keyed by `(district, state)`, but a farm only knows its centroid.
When a boundary is saved, `farms.service` reverse-geocodes that centroid and
stores the district, state, and which provider resolved them.

It is best-effort by design: a geocode outage must never stop a farmer saving
the boundary they just walked. An unresolved farm stores nulls, and
`/api/v1/weather` reports the data as unavailable for it — which is true.

## The demo farmer

For development and demos, `npm run seed:demo` creates one test farmer with a
field and a crop history:

```
email      demo.farmer@example.com
password   DemoFarmer#2026
```

It gives them a 2.5 acre plot outside Alwar, Rajasthan, and two wheat seasons —
one harvested, one planned. The field's area is derived by `utils/geo.ts`, the
same code the API uses, so the stored measurements are the real geodesic area of
the polygon rather than numbers typed in. The sowing and harvest dates are
computed from today's date, so the demo never reads as stale.

The script is deliberately not a migration. `supabase/migrations/` holds the
real schema and genuinely sourced reference rows; this invents a person, so it
stays something you run on purpose. It refuses to run when
`NODE_ENV=production`, and it needs `0003_seed_reference_data.sql` applied first
because it links the crops to the wheat row in the catalogue.

Re-running resets that farmer's field and crops to a known state.

The seeder also reverse-geocodes the demo field's district, because the API does
that when a boundary is saved and this script writes the row directly. Without
it the farm has no district and the weather tile stays empty.

For a full demonstration, run everything in dependency order:

```bash
npm run demo:full
```

**The seeder itself still writes no prices and no weather.** A fabricated
farmer is a test account; a fabricated mandi price is a number someone might act
on, and IMPLEMENTATION.md rule 13 does not make an exception for demos. Those
tables are filled by the ingestion scripts, from real providers — which is why
`demo:full` runs them rather than the seeder inventing rows.

## How authentication works

The backend never issues a token and never sees a password. Sign-up and sign-in
happen in the app, directly against Supabase Auth. This layer only verifies the
token that produces.

```text
App signs in with Supabase Auth
        ↓
App sends  Authorization: Bearer <access token>
        ↓
requireAuth verifies it with supabase.auth.getUser(token)
        ↓
req.auth = { userId, token }
        ↓
The service builds a Supabase client carrying that same token
        ↓
Postgres evaluates Row Level Security as that farmer
```

RLS is the enforcement floor, not the ceiling. Controllers also check ownership
explicitly, so a bug in one layer is not the only thing standing between
farmers. A farm belonging to someone else returns 404 — never a 403, which would
confirm the row exists.

### The service-role rule

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely. `adminClient()` in
`src/config/supabase.ts` must **never** be called from a request path that
returns farmer-owned rows. It is used only by the ingestion scripts, which
write reference data and serve nobody.

## Endpoints

Everything is under `/api/v1` and requires a bearer token, except `/health`.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Liveness. No token, no database call. |
| `GET` | `/api/v1/farmers/me` | The caller's profile |
| `PATCH` | `/api/v1/farmers/me` | `full_name`, `phone`, `language` only |
| `GET` | `/api/v1/farms` | The caller's fields, newest first. `?limit=` |
| `POST` | `/api/v1/farms` | Create from a drawn boundary |
| `GET` | `/api/v1/farms/:id` | 404 if it is not the caller's |
| `PATCH` | `/api/v1/farms/:id` | Boundary and/or name |
| `GET` | `/api/v1/farms/:farmId/crops` | Plantings on a field |
| `POST` | `/api/v1/farms/:farmId/crops` | |
| `PATCH` | `/api/v1/farms/:farmId/crops/:cropId` | |
| `GET` | `/api/v1/crops` | Crop catalogue |
| `GET` | `/api/v1/mandis` | `?state=&district=` |
| `GET` | `/api/v1/msp` | `?crop=&year=` |
| `GET` | `/api/v1/market-prices` | `?crop=&mandi=&from=&to=&limit=` |
| `GET` | `/api/v1/weather` | `?farmId=` — 503 when the district or observation is missing |
| `POST` | `/api/v1/ai/transcribe` | multipart `audio` — speech to text |
| `POST` | `/api/v1/ai/chat` | The avatar's reply |
| `POST` | `/api/v1/ai/speak` | The avatar's text-to-speech audio |
| `POST` | `/api/v1/predictions/soil-moisture` | Experimental XGBoost soil-moisture baseline |

## Experimental soil-moisture model

The delivered model runs as the independent FastAPI service in `../ml`; the
mobile app never calls it directly. Start that service on port 8000 and set:

```env
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_API_KEY=<same random secret as ml/.env>
```

The authenticated backend endpoint accepts the exact 14-feature contract from
the model's FastAPI route and returns its validated response. This particular
artifact is an experimental reduced-feature baseline: its metadata says it is
not production-ready and did not beat the median baseline. Consequently, the
backend preserves `experimental: true`, `production_ready: false`, the model's
warning, and `recommendation: null`. It must not be used for irrigation advice.

There is no farm delete endpoint: no screen asks for one.

The remaining prefixes TRD §14 reserves for later phases — `/buyers`, `/lots`,
`/offers` and `/recommendations` — are deliberately **not** mounted. They 404
rather than returning an empty stub. Predictions currently expose only the
experimental soil-moisture route documented above.

## Data that may not be connected

Phase 2.5 connected real providers for `market_prices` and `weather`, but both
endpoints still answer honestly when they have nothing, and that path matters
more than the happy one. IMPLEMENTATION.md rule 13 forbids presenting mock data
as real, so:

- `/market-prices` returns `[]` with a message saying the source is not
  connected when a filter matches nothing. It never widens the query until
  something comes back.
- `/weather` returns 503 `SERVICE_NOT_CONNECTED` when the farm has no resolved
  district, or no observation has been ingested for it. There is no
  nearest-district fallback: serving Jaipur's weather to a farmer in Kota would
  be a fabricated reading with a plausible number on it.

An empty price *list* is a coherent answer — no sales were recorded. An empty
weather *reading* is not, which is why the two differ.

Neither ever returns a number the server invented.

## Response envelope

TRD §15, produced in exactly one place (`src/utils/apiResponse.ts`). Nothing
else calls `res.json`.

```json
{ "success": true, "data": {}, "message": "Operation successful" }
```

```json
{ "success": false, "error": { "code": "INVALID_REQUEST", "message": "..." } }
```

Error codes: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`INVALID_REQUEST` (400), `CONFLICT` (409), `SERVICE_NOT_CONNECTED` (503),
`INTERNAL_ERROR` (500).

A stack trace, a Postgres message, or any other internal string never reaches a
client. The real error is logged server-side with the request id echoed in the
`x-request-id` response header.

## The area guard

Phase 1 computed the field area on the device and the database stored whatever
arrived. An HTTP API can be called by anything, so `src/utils/geo.ts` re-derives
area and centroid from the submitted polygon using the same Turf formulas as
`mobile/src/utils/geo.ts`, rejects a payload that disagrees by more than 1%, and
stores the server's numbers even when the client's were right.

The app still computes locally — the live readout while drawing needs it — but
the database now trusts only this layer.

## Layout

```text
src/
├── server.ts        boot
├── app.ts           the Express app, exported for tests
├── config/          env validation, Supabase client factories
├── middleware/      auth, validation, errors, logging
├── utils/           response envelope, ApiError, geometry
├── schemas/         zod request schemas
├── routes/          route table
├── controllers/     HTTP in, HTTP out — no Supabase here
├── services/        the only place a Supabase client is used
└── types/           row shapes
```

`routes → controllers → services → Supabase`. A controller never imports a
Supabase client; a service never touches `req` or `res`. That discipline is what
lets Phase 3 drop an ML service in behind the same controllers.

## Secrets

`SUPABASE_SERVICE_ROLE_KEY`, weather and maps API keys, `ML_SERVICE_URL` and any
LLM credentials belong **here**, in server-side environment variables, and never
in `mobile/`.
