# Phase 2 — build notes

What was actually built, what was deliberately left empty, and where each later
phase attaches. Written for whoever picks up Phase 3, in the shape of
`PHASE1_NOTES.md`.

---

## 1. What is real

| Feature | Where |
|---|---|
| Express API, TypeScript, Node 20+ | `backend/src/app.ts`, `server.ts` |
| Environment validated at boot | `backend/src/config/env.ts` |
| Supabase JWT verification | `backend/src/middleware/requireAuth.ts` |
| Per-request client so RLS applies as the farmer | `backend/src/config/supabase.ts` |
| TRD §15 response envelope, one implementation | `backend/src/utils/apiResponse.ts` |
| Errors that never leak a stack or a Postgres string | `backend/src/middleware/errorHandler.ts` |
| zod validation of every body, query and param | `backend/src/schemas/` |
| Server-side area re-derivation and the 1% guard | `backend/src/utils/geo.ts` |
| Farmer, farm, farm-crop, crop, mandi, MSP endpoints | `backend/src/routes/index.ts` |
| Phase 2 tables with RLS | `supabase/migrations/0002_phase2_schema.sql` |
| Verifiable reference seeds | `supabase/migrations/0003_seed_reference_data.sql` |
| The app reading and writing through the API | `mobile/src/services/api.ts`, `farms.ts`, `profiles.ts` |

The full farmer journey — register, draw, calculate, save, Home — now runs
through the backend. No screen, context or navigator changed to make that
happen.

## 2. What is deliberately empty

IMPLEMENTATION.md rule 13 forbids presenting mock data as real. These tables
exist, are queried by real code, and hold nothing:

| Surface | State in Phase 2 | Arrives in |
|---|---|---|
| `market_prices` | Empty table. `/market-prices` returns `[]` and says the source is not connected | Phase 3 |
| `weather` | Empty table. `/weather` returns 503 `SERVICE_NOT_CONNECTED` | Phase 3 |
| `farm_crops` | Real table and real endpoints; no screen writes to it yet | Phase 3 |
| Home weather / growth / market tiles | Unchanged from Phase 1: `—` plus an explanatory line | Phase 3 |
| `/buyers`, `/lots`, `/offers`, `/predictions`, `/ai` | Not mounted. They 404 | Phases 3–5 |

The seeded rows — the crop catalogue, eight Rajasthan mandis, five years of
published wheat MSP — are real values with a `source` on every row. Nothing was
invented to make a screen look populated.

## 3. Deviations from the plan, and why

**TypeScript, not JavaScript.** IMPLEMENTATION.md §2 and TRD §3 both say
"Node.js, Express.js, JavaScript". `mobile/` is strict TypeScript throughout and
the API carries the same domain objects the app already types by hand, so a
typed server keeps the two from drifting silently. Agreed before implementation.

**`market_arrivals` is folded into `market_prices.arrivals_tonnes`.**
IMPLEMENTATION.md lists it as its own table. Arrivals arrive attached to a price
observation in both the AGMARKNET feed and
`ml/datasets/krishinetra_mandi_rajasthan.csv`, so a separate table would be
one-to-one with `market_prices` and buy nothing but a join.

**`/weather` returns 503, not an empty reading.** This differs on purpose from
`/market-prices`, which returns an empty array. An empty price *list* is a
coherent answer — no sales were recorded. There is no such thing as "no
weather", so reporting the service as unavailable is the honest response.

**No farm delete endpoint.** Phase 1 has no delete path and no screen asks for
one. Adding it now would be scope the product has not requested.

**The server overrides the client's area.** Phase 1 computed area on the device
and the database stored what arrived. Once an HTTP API is reachable, anything
can post to it, so `backend/src/utils/geo.ts` recomputes area and centroid from
the polygon, rejects a mismatch beyond 1%, and stores its own figures even when
the client's were correct. The app still computes locally for the live readout
while drawing.

**UUID validation is a regex, not zod's `.uuid()`.** Zod 4 enforces the RFC
version and variant nibbles, which would reject ids the `uuid` column itself
accepts — a stricter rule than the thing it guards. See
`backend/src/schemas/common.ts`.

**Auth did not move.** Sign-up and sign-in still go directly from the app to
Supabase Auth. The backend only verifies tokens, and `handle_new_user` remains
the profile creator: if the backend created profiles too, the two would race on
signup.

## 4. The two RLS shapes

Phase 1 had one: the farmer owns the row. Phase 2 adds a second.

```text
farm_crops                    for all to authenticated
                              using (auth.uid() = user_id)

crops, mandis, market_prices, for select to authenticated using (true)
msp, weather                  ...and no write policy at all
```

With RLS enabled and no insert/update/delete policy, only the service-role key
can write reference data. That is deliberate — a farmer never writes a mandi
price. `user_id` is denormalised onto `farm_crops` so the policy is a column
comparison rather than a subquery against `farms`.

## 5. Where the later phases attach

**Phase 3 (ML / market intelligence).**

- `market_prices` already has the columns the ML dataset uses. Ingestion fills
  it; `/market-prices` starts returning rows with no controller change.
- `weather` holds **observed** values only. Forecasts get their own table —
  `ML1_IMPLEMENTATION.md` §46 requires the two to stay distinguishable.
- `farm_crops` is where a prediction request reads the farmer's crop and variety.
- `/predictions` and `/recommendations` become new route files calling
  `ML_SERVICE_URL`, which is already a commented placeholder in
  `backend/.env.example`. Node stays the abstraction layer; the app never calls
  the Python service.
- TRD §23 still holds: when a prediction fails, show that it is unavailable —
  never a fabricated number.

**Phase 4 (marketplace).** `mandis.latitude` / `longitude` are null on purpose
and need a verified source before distance-based buyer matching can use them.

**Phase 5 (avatar).** Unchanged from Phase 1 — `avatarMachine.ts` is still a
pure reducer, and the tool functions in TRD §20 map onto the endpoints this
phase created.

## 6. Testing

**Backend: 51 tests across 3 suites** (`cd backend && npm test`).

- `src/api.test.ts` — the real router, middleware, controllers and services with
  only the Supabase clients replaced. Covers the auth guard, both envelope
  shapes, the absence of stack traces and Postgres text, the area guard, that
  `user_id` comes from the token, that another farmer's field reads as 404
  rather than 403, the not-connected responses, and that the later-phase
  prefixes are absent rather than stubbed.
- `src/utils/geo.test.ts` — geodesic area, unit conversion, and every branch of
  the area guard including the tolerance boundary.
- `src/schemas/farm.schema.test.ts` — non-Polygon, unclosed ring, short ring,
  out-of-range coordinates, holes, and a `user_id` smuggled into the body.

**Mobile: 141 tests across 11 suites** (`cd mobile && npm test`) — the Phase 1
119 plus 22 new. `api.test.ts`, `farms.test.ts` and `profiles.test.ts` cover
token attachment, envelope unwrapping, error-code mapping, the network and
timeout paths, and numeric coercion.

Still to verify by hand, because they need a device and a live project:

- Sign in as a second account and confirm the first account's farm returns 404.
  This closes the RLS item left open in `PHASE1_NOTES.md` §6.
- Session persistence across a cold restart, now that data goes through the API.
- The app's error state with the backend stopped.
