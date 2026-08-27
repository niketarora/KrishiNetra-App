# backend — Phase 2

Not started. This directory is a placeholder so the Phase 2 work has a home and
the repository matches IMPLEMENTATION.md §5.

Phase 2 implements a Node.js + Express API sitting between the mobile app and
Supabase, external agricultural APIs, and (later) the ML services:

```
src/
├── controllers/
├── routes/
├── services/
├── middleware/
├── utils/
└── config/
server.js
```

Scope (TRD §6, IMPLEMENTATION.md Phase 2):

- Farmer, farm and crop APIs
- Market, MSP and weather data schemas
- Authentication middleware verifying Supabase JWTs
- Row Level Security enforcement alongside backend ownership checks

## Attaching the mobile app

The app already routes every data access through `mobile/src/services/farms.ts`
and `mobile/src/services/profiles.ts`. Phase 2 replaces the bodies of those two
modules with `fetch` calls to this API — no screen or context changes.

## Secrets

`SUPABASE_SERVICE_ROLE_KEY`, weather/maps API keys, `ML_SERVICE_URL` and any
LLM credentials belong **here**, in server-side environment variables, and never
in `mobile/`.
