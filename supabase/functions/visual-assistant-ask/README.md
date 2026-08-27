# visual-assistant-ask — temporary vision proxy

Not part of the Phase 2 `backend/` (Node/Express) plan in `docs/TRD.md` — this
is a small, deliberately temporary Supabase Edge Function that exists only to
keep a vision-model API key off the mobile client while the "Ask KrishiNetra"
camera prototype is being demoed. Delete it once the real pipeline (Engine 2 +
`backend/`) exists — nothing else in the app depends on this function staying
around.

## What it does

Receives `{ imageBase64, mimeType, question }` from the mobile app (see
`mobile/src/features/visualAssistant/demo.ts`), sends the image + question to
a free-tier Gemini vision model, and returns `{ answer }`. It never receives
or forwards anything to Engine 2 — this is a raw, unverified LLM answer, not a
KrishiNetra agricultural decision (see `docs/TRD.md` §21/§25).

## Model and cost

Model: `gemini-3.5-flash-lite` — vision-capable, and listed with an explicit
**Free of charge** row (Standard tier) on Google's own pricing page
(https://ai.google.dev/gemini-api/docs/pricing) as of this writing. A Google
AI Studio API key does **not** require a linked billing account or credit
card to use the free tier.

Before relying on this for a demo, do a 30-second sanity check yourself:
open https://aistudio.google.com, create/open an API key, and confirm the
model picker shows a "Free" badge next to `gemini-3.5-flash-lite` for your
project — Google's free-tier model list can change without notice, and a
live check costs nothing.

## Setup

```bash
# One-time: link this repo's supabase/ to your Supabase project
supabase link --project-ref <your-project-ref>

# Store the Gemini key as a server-side secret — never in mobile/ or .env
supabase secrets set GEMINI_API_KEY=your-key-from-aistudio.google.com

# Deploy
supabase functions deploy visual-assistant-ask
```

Local development: `supabase functions serve visual-assistant-ask --env-file supabase/functions/.env.local`
(create that file locally with `GEMINI_API_KEY=...`; it's gitignored the same
way `mobile/.env` is — never commit it).

## Auth

Supabase Edge Functions verify the caller's JWT by default. This function
does not disable that, so only a signed-in farmer's mobile session can invoke
it — the same protection every other Supabase-backed read/write in this app
already has.

## Known gap

The exact raw JSON field holding Gemini's answer text was confirmed only via
the SDK's `output_text` accessor at implementation time, not a literal raw
JSON example. `index.ts` tries `output_text` first, one fallback shape
second, and fails loudly (never returns an empty/invented string) if neither
matches — check the function logs if you see `vision_api_unexpected_response`
and adjust the parsing to match what Gemini actually returned.
