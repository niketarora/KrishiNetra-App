# backend

The KrishiNetra 2.0 API. Node.js + Express + TypeScript, sitting between the
mobile app and Supabase — and, in later phases, between the app and the ML
services and external agricultural APIs.

Built in Phase 2. See `docs/PHASE2_IMPLEMENTATION.md` for the plan it follows
and `docs/PHASE2_NOTES.md` for what was actually built.

## Prerequisites

- Node 20 or newer
- A Supabase project with `supabase/migrations/0001`, `0002` and `0003` applied

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

**`market_prices` and `weather` stay empty even for the demo.** A fabricated
farmer is a test account; a fabricated mandi price is a number someone might act
on, and IMPLEMENTATION.md rule 13 does not make an exception for demos. Those
screens will say the data is not connected, which is true until Phase 3.

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
returns farmer-owned rows. In Phase 2 it exists only for reference-data writes.

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
| `GET` | `/api/v1/weather` | 503 in Phase 2 — no provider connected |

There is no farm delete endpoint: no screen asks for one.

The prefixes TRD §14 reserves for later phases — `/buyers`, `/lots`, `/offers`,
`/predictions`, `/recommendations`, `/ai` — are deliberately **not** mounted.
They 404 rather than returning an empty stub.

## Data that is not connected yet

`market_prices` and `weather` ship empty. IMPLEMENTATION.md rule 13 forbids
presenting mock data as real, so:

- `/market-prices` returns `[]` with a message saying the source is not
  connected. The query is real and starts returning rows the moment Phase 3
  ingests AGMARKNET data.
- `/weather` returns 503 `SERVICE_NOT_CONNECTED`. An empty price *list* is a
  coherent answer; an empty weather *reading* is not.

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
