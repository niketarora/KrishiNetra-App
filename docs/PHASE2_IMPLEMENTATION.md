# KrishiNetra 2.0 — Phase 2 Implementation Plan

## Backend Foundation + Agricultural Data

This document defines the complete implementation plan for **Phase 2** of
KrishiNetra 2.0.

Phase 1 is complete: an Expo/TypeScript app with Supabase email authentication,
farm boundary drawing, geodesic area calculation, the Home screen, and the full
AI Avatar UI. See `docs/PHASE1_NOTES.md` for what is real and what was
deliberately left empty.

Phase 2 builds the Node.js + Express layer between the mobile app and Supabase,
adds the agricultural data schemas the intelligence layer will later need, and
moves the app's data access onto that API.

> **Important:** This phase implements no ML, no market intelligence, no
> marketplace, and no avatar intelligence. It builds the foundation those phases
> attach to.

---

# 1. Objective

At the end of Phase 2:

```text
React Native App
      │
      │  HTTPS / REST  (Bearer <supabase access token>)
      ▼
Node.js + Express API
      │
      ▼
   Supabase
   PostgreSQL + RLS
```

The app no longer queries Supabase tables directly. Every read and write of
farmer data travels through the backend, which verifies the farmer's identity,
validates the payload, and lets Row Level Security enforce ownership at the
database.

## 1.1 In scope

```text
Node.js + Express API (TypeScript)
Supabase integration via forwarded JWT
Farmer APIs        (profile)
Farm APIs          (boundary CRUD)
Crop APIs          (catalogue + per-farm plantings)
Market data schema (mandis, market_prices, msp)
Weather data schema
Authentication middleware
Row Level Security for every new table
Consistent API response envelope
Mobile data-layer cutover
Backend test suite
```

## 1.2 Explicitly out of scope

```text
ML model integration
Price prediction endpoints
Selling recommendations
Buyers / buyer requirements
Crop lots / offers / orders
Logistics / storage / payments / transactions
Live external data ingestion (AGMARKNET, weather providers)
Speech-to-text / text-to-speech
AI agent or avatar intelligence
New farmer-facing screens
```

Do not build any of the above during Phase 2, even though later sections of
`docs/IMPLEMENTATION.md` and `docs/TRD.md` describe them.

## 1.3 The one rule that governs empty data

`docs/IMPLEMENTATION.md` rule 13 still applies:

> Do not present mock data as real.

Phase 2 creates the market and weather tables but does not fill them. Every
endpoint over an empty table must say so plainly. It must never return a
plausible-looking number.

---

# 2. Decisions Taken

These four decisions were agreed before planning and shape everything below.

## 2.1 The backend is written in TypeScript

`docs/IMPLEMENTATION.md` §2 and `docs/TRD.md` §3 both say "Node.js, Express.js,
JavaScript". Phase 2 deviates and uses TypeScript, because:

- `mobile/` is strict TypeScript throughout.
- The request and response shapes are the same domain objects the mobile
  services already type by hand (`mobile/src/services/database.types.ts`).
- A typed API surface prevents the client and server drifting silently.

Record this deviation in `docs/PHASE2_NOTES.md` in the same way Phase 1 recorded
SecureStore and JSONB.

## 2.2 The backend forwards the farmer's JWT

Two models were considered:

```text
Option A — forward the farmer's JWT      ← chosen
Option B — service-role key + code-only ownership checks
```

Option A is chosen because RLS remains the enforcement floor. If a controller
ever forgets an ownership check, Postgres still returns nothing. Option B makes
a single missed check enough to expose every farmer's data.

The service-role key exists in the backend environment but is used **only** for
reference-data writes (seeding and, in a later phase, ingestion). It must never
appear on a request path that returns farmer-owned rows.

## 2.3 The mobile app cuts over its data layer, not its auth

```text
Auth        → stays direct to Supabase Auth from the app
Farm data   → moves to the Express API
Profile     → moves to the Express API
```

Passwords stay entirely inside Supabase Auth, as `docs/IMPLEMENTATION.md`
requires. The backend only *verifies* the token the app already holds.

This is also why the `handle_new_user` trigger stays the profile creator — if
the backend also created profiles, the two would race on signup.

## 2.4 Reference data is seeded only where it is verifiable

The market, MSP, weather and mandi tables are created. They are seeded only with
rows whose provenance can be stated:

```text
crops          → seeded (a small, factual catalogue)
mandis         → seeded (real Rajasthan APMC mandi names)
msp            → seeded (published Government of India MSP)
market_prices  → EMPTY, arrives in Phase 3
weather        → EMPTY, arrives in Phase 3
```

Every seeded table carries a `source` column naming where the value came from.

---

# 3. Database — Migration `0002_phase2_schema.sql`

Create `supabase/migrations/0002_phase2_schema.sql`.

Match the style of `0001_phase1_schema.sql` exactly:

```text
create table if not exists
check constraints on every bounded value
comment on table for every table
set_updated_at trigger (reuse the existing function — do not redefine it)
alter table … enable row level security
drop policy if exists … before every create policy
nothing granted to anon
```

## 3.1 Two ownership shapes

Phase 1 had one shape: the farmer owns the row. Phase 2 introduces a second.

### Farmer-owned tables

```text
farm_crops
```

One policy, mirroring the existing farms policy:

```text
for all
to authenticated
using      (auth.uid() = user_id)
with check (auth.uid() = user_id)
```

Carry `user_id` on the row alongside `farm_id`, so the policy is a column
comparison rather than a subquery against `farms`.

### Reference tables

```text
crops
mandis
market_prices
msp
weather
```

One policy each:

```text
for select
to authenticated
using (true)
```

No insert, update or delete policy is created. With RLS enabled and no write
policy, only the service-role key can write. This is deliberate: reference data
is never written by a farmer.

## 3.2 `crops`

The crop catalogue. Reference data.

```text
id            uuid primary key default gen_random_uuid()
code          text not null unique          -- 'wheat'
name_en       text not null                 -- 'Wheat'
name_hi       text                          -- 'गेहूँ'
category      text                          -- 'cereal'
default_unit  text not null default 'quintal'
created_at    timestamptz not null default now()
updated_at    timestamptz not null default now()
```

`name_hi` exists because the app already ships English and Hindi
(`mobile/src/i18n/locales/`). Crop names are data, not UI copy, so they belong
in the table rather than the locale files.

## 3.3 `farm_crops`

What the farmer has planted on a field. Farmer-owned.

```text
id                   uuid primary key default gen_random_uuid()
farm_id              uuid not null references public.farms (id) on delete cascade
user_id              uuid not null references auth.users (id) on delete cascade
crop_id              uuid not null references public.crops (id)
variety              text
sown_on              date
expected_harvest_on  date
area_acres           numeric(12, 4) check (area_acres > 0)
status               text not null default 'planned'
notes                text
created_at           timestamptz not null default now()
updated_at           timestamptz not null default now()
```

Constraints:

```text
farm_crops_status_check
  status in ('planned', 'sown', 'growing', 'harvested')

farm_crops_harvest_after_sowing
  expected_harvest_on is null
  or sown_on is null
  or expected_harvest_on >= sown_on
```

Index:

```text
farm_crops_farm_id_idx on (farm_id)
```

Note: `area_acres` here is the portion of the field under this crop. It is not
required to equal `farms.area_acres` — a farmer may split a field.

## 3.4 `mandis`

Market yards. Reference data.

```text
id         uuid primary key default gen_random_uuid()
code       text not null unique
name       text not null
district   text not null
state      text not null
latitude   numeric(9, 6) check (latitude between -90 and 90)
longitude  numeric(9, 6) check (longitude between -180 and 180)
source     text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

`latitude` and `longitude` are nullable. Leave them null rather than guess at
coordinates. Distance-based buyer matching is Phase 4 and can backfill them from
a verified source then.

Index:

```text
mandis_state_district_idx on (state, district)
```

## 3.5 `market_prices`

Daily mandi price observations. Reference data. **Ships empty.**

```text
id              uuid primary key default gen_random_uuid()
mandi_id        uuid not null references public.mandis (id) on delete cascade
crop_id         uuid not null references public.crops (id)
variety         text
grade           text
price_date      date not null
min_price       numeric(12, 2) check (min_price > 0)
max_price       numeric(12, 2) check (max_price > 0)
modal_price     numeric(12, 2) not null check (modal_price > 0)
arrivals_tonnes numeric(12, 3) check (arrivals_tonnes >= 0)
source          text not null
created_at      timestamptz not null default now()
```

Constraints:

```text
market_prices_price_ordering
  (min_price is null or min_price <= modal_price)
  and (max_price is null or modal_price <= max_price)

unique (mandi_id, crop_id, variety, grade, price_date)
```

Index:

```text
market_prices_crop_date_idx on (crop_id, price_date desc)
```

Prices are stored per quintal, matching MSP and AGMARKNET convention. State this
in a `comment on column`.

### Deviation to record

`docs/IMPLEMENTATION.md` lists a separate `market_arrivals` table. Phase 2 folds
arrivals into `market_prices.arrivals_tonnes` instead, because:

- That is exactly how arrivals appear in
  `ml/datasets/krishinetra_mandi_rajasthan.csv`, the dataset ML Model 1 uses.
- A separate table would be one-to-one with `market_prices` and would buy
  nothing but a join.

Record this in `docs/PHASE2_NOTES.md`.

## 3.6 `msp`

Minimum Support Price. Reference data.

```text
id                uuid primary key default gen_random_uuid()
crop_id           uuid not null references public.crops (id)
season            text not null            -- 'rabi' | 'kharif'
marketing_year    text not null            -- '2025-26'
price_per_quintal numeric(12, 2) not null check (price_per_quintal > 0)
effective_from    date
source            text not null
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()

unique (crop_id, marketing_year, season)
```

## 3.7 `weather`

Observed weather. Reference data. **Ships empty.**

```text
id            uuid primary key default gen_random_uuid()
district      text not null
state         text not null
observed_on   date not null
temperature_c numeric(6, 2)
rainfall_mm   numeric(8, 2) check (rainfall_mm >= 0)
humidity_pct  numeric(5, 2) check (humidity_pct between 0 and 100)
source        text not null
created_at    timestamptz not null default now()

unique (district, state, observed_on)
```

Weather is keyed by district rather than by farm. A per-farm forecast is a
Phase 3 concern and will be derived by locating the farm's centroid within a
district, not by storing a row per farm.

`docs/ML1_IMPLEMENTATION.md` §46 draws a hard line between *observed* and
*forecast* weather. This table is observations only. When forecasts arrive, they
go in a separate table so the two can never be confused.

## 3.8 Triggers

Attach the existing `public.set_updated_at()` trigger to every new table that
has an `updated_at` column:

```text
crops
farm_crops
mandis
msp
```

`market_prices` and `weather` are append-only observations and have no
`updated_at`.

---

# 4. Reference Data — Migration `0003_seed_reference_data.sql`

Create `supabase/migrations/0003_seed_reference_data.sql`.

The file must be **idempotent**: every insert ends with `on conflict … do
nothing`, so re-running it is safe.

## 4.1 What to seed

```text
crops   — the crop catalogue, starting with wheat
mandis  — real Rajasthan APMC mandi names
msp     — published Government of India wheat MSP
```

## 4.2 What NOT to seed

```text
market_prices  — no invented prices, ever
weather        — no invented observations, ever
farm_crops     — farmer data, never seeded
```

## 4.3 Provenance rules

- Every seeded row sets `source` to a statement of where the value came from
  (for example the MSP notification, or the AGMARKNET mandi directory).
- Mandi names must be cross-checked against the distinct `mandi` and `district`
  values in `ml/datasets/krishinetra_mandi_rajasthan.csv`, **and** against the
  real Rajasthan APMC list. The dataset is synthetic
  (`docs/ML1_IMPLEMENTATION.md` §3); its mandi names are plausible but are not
  automatically authoritative. Seed only names that are genuinely real mandis.
- If a value cannot be verified, leave the column null. A null is honest; a
  guess is not.

---

# 5. Backend Folder Structure

```text
backend/
│
├── package.json
├── tsconfig.json
├── jest.config.ts
├── .env.example
├── .gitignore
├── README.md
│
└── src/
    ├── server.ts                  # loads env, starts listening
    ├── app.ts                     # builds the Express app, exported for tests
    │
    ├── config/
    │   ├── env.ts                 # zod-validated process.env
    │   └── supabase.ts            # userClient(token) + adminClient()
    │
    ├── middleware/
    │   ├── requireAuth.ts
    │   ├── validate.ts
    │   ├── errorHandler.ts
    │   ├── notFound.ts
    │   └── requestLogger.ts
    │
    ├── utils/
    │   ├── apiResponse.ts
    │   ├── ApiError.ts
    │   └── geo.ts
    │
    ├── schemas/                   # zod request schemas
    │   ├── farm.schema.ts
    │   ├── farmCrop.schema.ts
    │   ├── profile.schema.ts
    │   └── query.schema.ts
    │
    ├── routes/
    │   ├── index.ts               # mounts everything under /api/v1
    │   ├── farmers.routes.ts
    │   ├── farms.routes.ts
    │   ├── crops.routes.ts
    │   ├── mandis.routes.ts
    │   ├── marketPrices.routes.ts
    │   ├── msp.routes.ts
    │   └── weather.routes.ts
    │
    ├── controllers/               # HTTP in, HTTP out. No Supabase here.
    │
    ├── services/                  # the ONLY place a Supabase client is used
    │
    └── types/
        └── domain.ts
```

Runtime and tooling:

```text
Node 20+
Express 5
TypeScript (strict)
zod            request validation
npm            (matches mobile/)
jest + ts-jest + supertest
```

## 5.1 Layering rule

```text
routes  →  controllers  →  services  →  Supabase
```

A controller never imports a Supabase client. A service never touches `req` or
`res`. This is the same discipline `mobile/src/services/` already follows and is
what makes the ML service swappable in Phase 3.

## 5.2 Shared types

There is no monorepo. `backend/src/types/domain.ts` and
`mobile/src/services/database.types.ts` are separate hand-written copies of the
same row shapes, exactly as `database.types.ts` already relates to the SQL
migration.

Carry the same instruction its header already carries: when the schema changes,
update all of them together.

---

# 6. Authentication and Authorization Model

## 6.1 The flow

```text
App signs in with Supabase Auth
        ↓
App holds an access token (JWT)
        ↓
App sends:  Authorization: Bearer <token>
        ↓
requireAuth verifies the token with supabase.auth.getUser(token)
        ↓
req.auth = { userId, token }
        ↓
Service builds a Supabase client carrying that same token
        ↓
Postgres evaluates RLS as that farmer
```

## 6.2 `config/supabase.ts`

Two factory functions, and only two.

```text
userClient(accessToken)
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  })

adminClient()
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
```

`persistSession: false` matters on the server: a shared client that remembered a
session would leak one farmer's identity into another's request.

Create a fresh `userClient` per request. Do not cache clients by token.

### The service-role rule

`adminClient()` must never be called from a code path that returns farmer-owned
rows. In Phase 2 it is used only by reference-data writes. State this in a
comment at the top of the file, and again in `backend/README.md`.

## 6.3 `middleware/requireAuth.ts`

```text
Read the Authorization header
Reject anything that is not `Bearer <token>`   → 401 UNAUTHENTICATED
Verify with supabase.auth.getUser(token)
On error or missing user                       → 401 UNAUTHENTICATED
Attach req.auth = { userId, token }
```

Every route except `GET /health` sits behind this.

## 6.4 Two layers of authorization

RLS is the floor, not the ceiling. Controllers still check ownership explicitly,
so a bug in a policy is not the only thing standing between farmers.

In practice this means: a `GET /farms/:id` for another farmer's field returns
nothing from Postgres, and the controller turns "nothing" into a 404 — never a
500, and never a 403 that would confirm the row exists.

---

# 7. API Response Standard

Follow `docs/TRD.md` §15 exactly.

## 7.1 Success

```json
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

## 7.2 Error

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request"
  }
}
```

## 7.3 `utils/apiResponse.ts` and `utils/ApiError.ts`

```text
sendOk(res, data, message?)        → 200 with the success envelope
sendCreated(res, data, message?)   → 201
ApiError(status, code, message)    → thrown by controllers and services
```

Nothing in the codebase writes `res.json` directly. The envelope is produced in
one place so it cannot drift.

## 7.4 Error codes

```text
UNAUTHENTICATED        401  missing, malformed or expired token
FORBIDDEN              403  authenticated but not permitted
NOT_FOUND              404  no such resource for this farmer
INVALID_REQUEST        400  validation failed
CONFLICT               409  unique constraint violated
SERVICE_NOT_CONNECTED  503  the upstream data source does not exist yet
INTERNAL_ERROR         500  anything unexpected
```

## 7.5 `middleware/errorHandler.ts`

```text
Log the real error server-side, with the request id
Return only { code, message }
Never a stack trace
Never a Postgres or PostgREST message
```

`docs/TRD.md` §15 and §23 both require this, and the mobile side already assumes
it: `mobile/src/services/errors.ts` exists precisely so that internal strings
never reach a farmer.

Unhandled errors become `INTERNAL_ERROR` with a generic message. A Postgres
unique-violation becomes `CONFLICT`. A zod failure becomes `INVALID_REQUEST`.

---

# 8. Endpoint Reference

All endpoints are mounted under `/api/v1`. Everything except `/health` requires
authentication.

## 8.1 Health

```text
GET /health
```

Unauthenticated. Returns service name, version and uptime. No database call —
this is a liveness probe, not a readiness probe.

## 8.2 Farmer

```text
GET   /api/v1/farmers/me
PATCH /api/v1/farmers/me
```

The profile of the token's own user. There is no `/farmers/:id`; a farmer can
only ever read themselves.

`PATCH` accepts `full_name`, `phone`, `language` only. Any other key is
rejected. This mirrors `updateProfile` in `mobile/src/services/profiles.ts`.

## 8.3 Farms

```text
GET   /api/v1/farms                 the caller's farms, newest first
POST  /api/v1/farms                 create from drawn boundary points
GET   /api/v1/farms/:id             404 if not the caller's
PATCH /api/v1/farms/:id             boundary and/or name
```

There is no delete endpoint. Phase 1 has no delete path and no screen asks for
one; adding one now would be scope the product has not requested.

`GET /api/v1/farms` supports `?limit=` so the mobile `getCurrentFarm` can ask
for the single newest field, which is the only shape the app uses today.

### Create / update payload

```text
{
  "name": "North field" | null,
  "boundary": { "type": "Polygon", "coordinates": [[[lng, lat], …]] },
  "area_sq_meters": 12345.67,
  "area_acres": 3.0505,
  "area_hectares": 1.2346,
  "centroid_lat": 26.912345,
  "centroid_lng": 75.787654
}
```

The client sends its computed measurements; the server re-derives and verifies
them (§9.2).

`user_id` is never accepted from the client. It comes from `req.auth.userId`.

## 8.4 Farm crops

```text
GET   /api/v1/farms/:farmId/crops
POST  /api/v1/farms/:farmId/crops
PATCH /api/v1/farms/:farmId/crops/:cropId
```

The controller confirms the farm belongs to the caller before touching
`farm_crops`, and sets `user_id` from the token rather than the body.

No mobile screen consumes these in Phase 2. They exist so Phase 3 has somewhere
to read the crop from when it asks for a price prediction.

## 8.5 Reference data

```text
GET /api/v1/crops
GET /api/v1/mandis?state=&district=
GET /api/v1/msp?crop=&year=
```

These return seeded rows and work from day one.

## 8.6 Market prices

```text
GET /api/v1/market-prices?crop=&mandi=&from=&to=
```

The table is empty in Phase 2. The endpoint validates its query parameters and
returns:

```json
{
  "success": true,
  "data": [],
  "message": "Market price data is not connected yet."
}
```

An empty array plus an explanation. Never a sample price.

## 8.7 Weather

```text
GET /api/v1/weather?farmId=
```

There is no weather provider in Phase 2, so this returns:

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_NOT_CONNECTED",
    "message": "Weather data is not connected yet."
  }
}
```

with HTTP 503.

This differs deliberately from market prices: an empty price *list* is a
coherent answer, but an empty weather *reading* is not — there is no such thing
as "no weather". Saying the service is unavailable is the honest response, and
it is exactly what the Home screen's existing "Available in a future update"
tile already expects.

## 8.8 Not implemented

Requests to any other `/api/v1/*` prefix listed in `docs/TRD.md` §14 fall
through to `notFound` and return 404 `NOT_FOUND`. Do not stub them.

---

# 9. Validation and the Area Guard

## 9.1 Request validation

Every body and every query string is parsed by a zod schema before the
controller runs. `middleware/validate.ts` takes a schema, parses, and throws
`ApiError(400, 'INVALID_REQUEST')` on failure with a safe, field-level message.

The boundary schema is the important one, and it must mirror the database check
constraints in `0001_phase1_schema.sql`:

```text
type === 'Polygon'
coordinates is an array with exactly one linear ring
the ring has at least 4 positions (3 corners + the closing point)
the first and last positions are identical
every position is [lng, lat] with lng ∈ [-180, 180], lat ∈ [-90, 90]
```

Also validate, per `docs/TRD.md` §22:

```text
uuid path parameters
numeric ranges
date formats on from/to query parameters
string length caps on name, variety, notes
```

## 9.2 The server re-derives the area

`backend/src/utils/geo.ts` recomputes area and centroid from the submitted
polygon using the same `@turf/area` and `@turf/centroid` calls as
`mobile/src/utils/geo.ts`, and the same constant:

```text
SQ_METERS_PER_ACRE = 4046.8564224
```

Then:

```text
If the client's area differs from the server's by more than 1%
  → 400 INVALID_REQUEST
Otherwise
  → store the SERVER's numbers, not the client's
```

Why this matters: Phase 1 computed area on the device and the database accepted
whatever arrived. Once an HTTP API is public, anything can post to it. The
client keeps computing for the live on-map readout — that is a UX need — but the
database now trusts only the server.

The 1% tolerance absorbs floating-point differences between the two runtimes
without admitting a meaningfully wrong number.

## 9.3 Other hardening

```text
express.json({ limit: '256kb' })   a boundary is small; a huge body is an attack
CORS restricted to CORS_ORIGINS
Rate limiting on all /api/v1 routes
Request id on every request, logged with every error
```

---

# 10. Environment and Secrets

## 10.1 Backend — `backend/.env.example`

```text
PORT=4000
NODE_ENV=development

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

CORS_ORIGINS=http://localhost:8081

# Later phases — present as placeholders only, unused in Phase 2
# WEATHER_API_KEY=
# ML_SERVICE_URL=
```

`config/env.ts` validates this with zod at boot and exits with a clear message
if a required variable is missing. A server that starts with half its
configuration is worse than one that refuses to start.

## 10.2 Mobile — `mobile/.env.example`

Add one variable:

```text
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
```

`10.0.2.2` is how the Android emulator reaches the host machine's `localhost`.
Document that in the README next to the existing Supabase and Maps key setup.

## 10.3 The secrets boundary

```text
Mobile may hold:   SUPABASE_URL, SUPABASE_ANON_KEY, EXPO_PUBLIC_API_URL,
                   the Android Maps key (restricted by package + SHA)

Backend only:      SUPABASE_SERVICE_ROLE_KEY, WEATHER_API_KEY,
                   ML_SERVICE_URL, any future LLM credentials
```

Add to the repository `.gitignore`:

```text
backend/.env
backend/dist
backend/node_modules
```

---

# 11. Mobile Cutover

Phase 1 was built for this. `docs/PHASE1_NOTES.md` §5:

> No screen imports `supabase` directly — every read and write goes through
> `src/services/farms.ts` and `src/services/profiles.ts`.

So the entire client-side change is four files plus one env variable.

```text
NO screen changes
NO context changes
NO navigator changes
NO change to AuthContext
```

## 11.1 New — `mobile/src/services/api.ts`

```text
apiFetch<T>(path, { method, body, signal })

  base URL from process.env.EXPO_PUBLIC_API_URL
  Authorization: Bearer <access token>
  Content-Type: application/json
  timeout via AbortController (~15s)

  on { success: true }   → return data as T
  on { success: false }  → throw toApiError(error.code, fallbackKey)
  on a non-JSON or non-2xx response → throw a network DataError
```

## 11.2 New — `getAccessToken()` in `mobile/src/services/supabase.ts`

A thin wrapper over `supabase.auth.getSession()` that returns the access token
or null.

Placing it here keeps `api.ts` from importing the Supabase query surface at all,
which preserves the rule that only this file knows the Supabase client exists.

## 11.3 Extend — `mobile/src/services/errors.ts`

Add one function:

```text
toApiError(code, message, fallbackKey) → DataError
```

mapping the API error codes from §7.4 onto the translation keys that already
exist:

```text
UNAUTHENTICATED        → auth.errors.generic
network / timeout      → auth.errors.network
SERVICE_NOT_CONNECTED  → the caller's fallback key
everything else        → the caller's fallback key
```

Do not modify `DataError`, `toDataError` or `mapAuthError`. Their tests must
still pass unchanged.

## 11.4 Rewrite — `farms.ts` and `profiles.ts`

Same exported function signatures, same `Farm` and `Profile` types, same
translation-key fallbacks. Only the bodies change:

```text
getCurrentFarm(userId)          → GET   /api/v1/farms?limit=1
createFarm(input)               → POST  /api/v1/farms
updateFarmBoundary(id, input)   → PATCH /api/v1/farms/:id
getProfile(userId)              → GET   /api/v1/farmers/me
updateProfile(userId, values)   → PATCH /api/v1/farmers/me
```

Notes:

- Keep `toFarmValues` in `farms.ts`. The client still computes; the server still
  verifies (§9.2).
- The `userId` parameters become unused — the token identifies the caller. Keep
  them in the signature so no calling context changes, and document why.
- Coerce numeric fields to `number` when parsing the response. PostgREST returns
  some numerics as strings, which is why `MainNavigator.tsx` already calls
  `Number(farm.centroid_lat)`. Normalising here keeps that working either way.

## 11.5 Auth stays where it is

`AuthContext` keeps calling `supabase.auth.signUp` and
`signInWithPassword` directly. Session persistence through
`mobile/src/services/sessionStorage.ts` is untouched.

---

# 12. Testing Requirements

## 12.1 Backend

`jest` + `ts-jest` + `supertest`, matching the mobile setup. Supabase clients
are mocked at the service boundary; these are not integration tests against a
live project.

```text
[ ] GET /health responds without a database
[ ] requireAuth rejects a missing Authorization header      → 401
[ ] requireAuth rejects a malformed header                  → 401
[ ] requireAuth rejects an invalid/expired token            → 401
[ ] a success response matches the TRD §15 envelope exactly
[ ] an error response matches the TRD §15 envelope exactly
[ ] no error response contains a stack trace
[ ] no error response contains a Postgres or PostgREST message
[ ] zod rejects a non-Polygon boundary
[ ] zod rejects an unclosed ring
[ ] zod rejects a ring with fewer than 4 positions
[ ] zod rejects out-of-range coordinates
[ ] the area guard rejects a payload whose area is inflated
[ ] the area guard accepts a payload within tolerance
[ ] a create stores the server-derived area, not the client's
[ ] user_id is taken from the token, not the body
[ ] another farmer's farm id returns 404, not 403 and not the row
[ ] GET /market-prices returns [] plus the not-connected message
[ ] GET /market-prices never returns a number
[ ] GET /weather returns 503 SERVICE_NOT_CONNECTED
[ ] an unknown /api/v1 path returns 404 NOT_FOUND
```

## 12.2 Mobile

The existing 119 tests across 8 suites must stay green.

New and updated, against a mocked `fetch`:

```text
[ ] apiFetch attaches the Bearer token
[ ] apiFetch unwraps the success envelope
[ ] apiFetch maps an error code to a translation key
[ ] apiFetch surfaces a timeout as the network translation key
[ ] farms.ts calls the right method and path for each operation
[ ] profiles.ts calls the right method and path for each operation
[ ] numeric fields arrive as numbers even when the API sends strings
```

## 12.3 Manual

`docs/TRD.md` §25 requires RLS to be tested. Two Phase 1 items remain open in
`docs/PHASE1_NOTES.md` §6 and are closed here:

```text
[ ] a second account cannot read the first account's farm
[ ] the session survives a cold app restart against the new API
```

---

# 13. Documentation Updates

```text
backend/README.md        rewrite: prerequisites, env, npm run dev,
                         the endpoint table, the JWT-forwarding model,
                         the service-role rule

docs/PHASE2_NOTES.md     new, in the shape of PHASE1_NOTES.md:
                         what is real, what is deliberately empty,
                         and the deviations

docs/PHASE1_NOTES.md     append to §5: the Phase 2 attachment actually taken

README.md                repo layout, backend setup, roadmap status
```

Deviations to record in `docs/PHASE2_NOTES.md`:

```text
1. TypeScript instead of the documented JavaScript, and why
2. market_arrivals folded into market_prices.arrivals_tonnes, and why
3. weather returns 503 rather than an empty reading, and why
4. no farm delete endpoint, because no screen asks for one
5. the server re-derives area and overrides the client's numbers
```

`ml/` is not touched by this phase.

---

# 14. Verification

```text
1.  cd backend && npm install && npm run typecheck && npm test

2.  Apply 0002 and 0003 in the Supabase SQL editor.
    Confirm every new table, every RLS policy, and the seeded
    crops / mandis / msp rows.
    Confirm market_prices and weather are empty.

3.  npm run dev
    curl http://localhost:4000/health   → {"success":true,…}

4.  curl http://localhost:4000/api/v1/farms
      → 401 UNAUTHENTICATED

    curl with a real access token from a signed-in session
      → the caller's farms in the success envelope

5.  cd mobile && npm run typecheck && npm test
      → the existing 119 tests plus the new ones, all green

6.  npx expo run:android with EXPO_PUBLIC_API_URL set
      register → draw boundary → see area → save → Home shows the acreage
      edit the boundary → the update persists
      kill and relaunch → still signed in, farm still loads

7.  RLS: sign in as a second account, request the first account's farm id
      → 404, not the row

8.  Stop the backend, reopen Home
      → the translated error state, not a crash and not a blank screen
```

---

# 15. Phase 2 Definition of Done

```text
[ ] 0002_phase2_schema.sql applied
[ ] 0003_seed_reference_data.sql applied and re-runnable
[ ] RLS enabled on every new table
[ ] reference tables have select-only policies
[ ] farm_crops has an owner policy
[ ] no fabricated market or weather row exists anywhere
[ ] backend runs on Node 20+ with TypeScript strict
[ ] env is validated at boot
[ ] requireAuth verifies Supabase JWTs
[ ] every query runs through a per-request user client
[ ] the service-role key touches no farmer-owned read path
[ ] every response uses the TRD §15 envelope
[ ] no stack trace or internal message reaches a client
[ ] every body and query is zod-validated
[ ] the server re-derives and stores the area
[ ] farmer, farm, farm-crop, crop, mandi, MSP endpoints work
[ ] market-price and weather endpoints answer honestly
[ ] backend test suite passes
[ ] mobile farms.ts and profiles.ts call the API
[ ] no screen, context or navigator changed
[ ] auth still goes directly to Supabase Auth
[ ] all mobile tests pass
[ ] the full farmer journey works end to end against the API
[ ] RLS verified with a second account
[ ] docs updated
[ ] no ML, market intelligence, marketplace or AI code was written
```

---

# 16. What Phase 3 Attaches To

Recorded here so the next phase does not have to rediscover it.

```text
market_prices     Phase 3 ingests AGMARKNET data into this table.
                  The schema already matches the columns
                  ml/datasets/krishinetra_mandi_rajasthan.csv uses.

weather           Phase 3 connects a provider. Forecast values go in a
                  SEPARATE table — ML1_IMPLEMENTATION.md §46 requires
                  observed and forecast weather to stay distinguishable.

farm_crops        Phase 3 reads the farmer's crop and variety here to
                  build a prediction request.

/api/v1/predictions
/api/v1/recommendations
                  New route files calling ML_SERVICE_URL, which already
                  has a placeholder in the backend environment.
                  Node stays the abstraction layer; the Python service
                  is never called from the app.

The empty surfaces listed in PHASE1_NOTES.md §2 keep their real layout,
so connecting them is a matter of feeding them data — and TRD §23 still
holds: when a prediction fails, show that it is unavailable, never a
fabricated number.
```
