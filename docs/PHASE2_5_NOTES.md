# Phase 2.5 — build notes

What was built, what is still deliberately empty, and where the remaining work
attaches. Written in the same shape as `PHASE1_NOTES.md` and `PHASE2_NOTES.md`.

Phase 2.5 was split into two stages, agreed before work started:

```text
2.5a  market ingestion + weather + the new Home blocks     COMPLETE
2.5b  speech-to-text + LLM + rigged 3D avatar              COMPLETE (see §6)
```

The split exists so there is a demo-able milestone before the 3D work, which is
the largest and least certain part of the phase.

---

## 1. What is real now

| Feature | Where |
|---|---|
| Real mandi prices from data.gov.in | `backend/src/ingestion/market/` |
| Real observed weather from Open-Meteo | `backend/src/ingestion/weather/` |
| Farm → district resolution | `backend/src/ingestion/geocode/reverseGeocode.ts` |
| `/api/v1/weather?farmId=` returning a real reading | `backend/src/controllers/reference.controller.ts` |
| Home crop tile | `mobile/src/screens/home/HomeScreen.tsx` |
| Home MSP tile | same, fed by `services/agronomy.ts` |
| Home weather tile, now with real data | same |
| Voice input, transcribed by Sarvam AI | `backend/src/ai/stt.service.ts` |
| Real conversational answers from Gemini | `backend/src/ai/llm.service.ts` |
| The avatar's real listen → think → speak loop | `mobile/src/features/avatar/AvatarContext.tsx` |
| Deterministic avatar animation | `mobile/src/components/avatar/animation/` |

Test counts are in §8.

## 2. What is still deliberately empty

| Surface | State | Arrives in |
|---|---|---|
| Growth stage tile | `—` + why it is missing | Phase 3 · demo-fillable |
| Field analysis: crop health, growth stage | `—` + why they are missing | Phase 3 · demo-fillable |
| Market screen: sell-or-wait recommendation | Says it needs the prediction model | Phase 3 · demo-fillable |
| History screen | The designed empty state | Phase 4 · demo-fillable |
| Market screen: 7-day trend | Draws once two days of prices are recorded | builds itself |

"Demo-fillable" means `EXPO_PUBLIC_DEMO_MODE=true` shows a clearly-labelled
sample value there — see §2c. Off by default, and never in a shipped build.
| Avatar answers about prices, predictions, buyers | The assistant says the service is not connected | Phase 3 / 4 |
| The 3D avatar model | Falls back to the Phase 1 photograph until a GLB is dropped in | see §6 |

Every screen that has a real source is now wired to it. The Home market card,
the Market screen's price and MSP comparison, and the Field screen's weather row
all read live rows, each shown with the date and mandi it came from.

What is left empty is what genuinely has no source. The line is between
**reporting** and **forecasting**: saying what a mandi paid last Tuesday is a
fact, and telling a farmer to hold their crop is a prediction. TRD §23 forbids
substituting a fabricated prediction, so the recommendation card says what it
needs and why instead of filling the space.

## 2b. Demonstrating the app

```bash
cd backend
npm run demo:full        # seed the farmer, then ingest real prices and weather
```

That runs `seed:demo`, `ingest:market` and `ingest:weather` in order, which is
the order they depend on: the seeder now reverse-geocodes the demo farm's
district (the API does this when a boundary is saved, and the script writes the
row directly, so it has to do the same lookup), and the weather ingester only
covers districts a farm actually sits in.

Sign in as `demo.farmer@example.com` / `DemoFarmer#2026`.

**The 7-day trend needs more than one day of data.** AGMARKNET publishes current
prices, not history, so the chart draws once `ingest:market` has run on two or
more days. It plots only the dates actually recorded and does not interpolate
across the gaps AGMARKNET leaves on holidays — a smooth line would imply prices
nobody ever saw.

## 2c. DEMO_MODE

Four surfaces have no data source at all: crop health and growth stage need the
Phase 3 satellite analysis, the sell-or-wait recommendation needs the price
prediction model, and History needs the Phase 4 transaction record.

`EXPO_PUBLIC_DEMO_MODE=true` fills them with sample values for a presentation.
This does not break rule 13; it takes the other way out of it. Every sample
value is drawn in an **off-palette violet**, carries a **SAMPLE DATA** badge,
and sits under a banner saying the screen is showing made-up values. Someone
looking at a projector can tell in a glance which numbers the app actually
knows.

Three properties make it safe, and all three are tested:

1. **Off unless the variable reads exactly `'true'`.** A truthy check would turn
   the string `'false'` into demo mode, which is the sort of accident that ships.
2. **It writes nothing.** `features/demo/demoMode.ts` is presentation-layer
   only, so no fabricated row can outlive the session — and the assistant
   answers from the database, so it can never repeat a sample value as fact.
   `grep -rn "DEMO_MODE" backend/src/` returns nothing.
3. **It never substitutes for a real value.** Where a source exists, the real
   value always wins and the sample is not consulted.

There is deliberately no runtime toggle — no `setDemoMode()`. A flag that can be
flipped at runtime is a flag that can be flipped in production.

When Phase 3 lands, delete `features/demo/` and its four call sites.

## 3. Decisions and deviations

**The backend is TypeScript, and so is this phase.** Carried over from Phase 2.

**A separate `market_arrivals` table is still not created.** Arrivals stay a
column on `market_prices`. The AGMARKNET daily-price resource does not send
arrivals at all, so the column is currently always null — which is the correct
representation of "the provider did not tell us", and better than a zero.

**Weather is keyed by district, and a farm now resolves to one.** Migration
`0004` adds `district`, `state` and `location_source` to `farms`, filled by a
Nominatim reverse-geocode when the boundary is saved. `IMPLEMENTATION_PHASE2_5.md`
§3.3 forbids *guessing* a district from coordinates; a gazetteer lookup is a
resolution, not a guess, and the provider that made it is recorded on the row.

All three columns are nullable, and the geocode is best-effort. A lookup failure
never blocks a farm being saved — the farmer keeps their boundary and the
weather tile stays empty.

**Weather sample points come from farms, not from mandis.** Open-Meteo needs a
coordinate and `mandis.latitude` is null by design (Phase 2 refused to invent
one). So the ingester takes one real coordinate from a farm already resolved to
that district. A district with no farms in it gets no weather, which costs
nothing.

**`/api/v1/weather` still answers 503 far more often than it answers data.**
Three separate paths lead there — no farm, no resolved district, no ingested
observation — and all three are honest. This was not weakened when the provider
was connected.

**The observed/forecast split is enforced twice.** The ingester only ever calls
Open-Meteo's *archive* endpoint, and the normalizer independently rejects any
future-dated row. `ML1_IMPLEMENTATION.md` §46 requires the two to stay
distinguishable, and one guard can be bypassed by a config change.

**Negative rainfall is discarded, not clamped.** Clamping to zero would assert a
dry day the provider never reported. The same reasoning applies to out-of-range
humidity and to any price that fails to parse: absent, not zero.

## 4. The rule that shaped every file

`IMPLEMENTATION.md` rule 13 — never present mock data as real — decided more of
this phase than any technical constraint. Concretely:

- A provider field that is missing stays null. It is never inferred from
  neighbouring fields or carried over from a previous row.
- A record failing validation is skipped and **counted with its reason**, which
  the ingest scripts print. A silent ingester is how fabricated data gets in.
- Ingestion maps to existing reference rows and never creates one. An unknown
  mandi is reported, not added.
- A provider outage writes nothing. The app keeps reporting "not connected".
- The demo seeder creates a farmer, a field and crops — but still no prices and
  no weather. A fabricated farmer is a test account; a fabricated mandi price is
  a number someone might act on.

## 5. Running ingestion

```bash
cd backend
npm run ingest:market    # needs MARKET_API_KEY from data.gov.in (free)
npm run ingest:weather   # no key; needs at least one farm with a district
```

Both print what they wrote and what they refused to write. `ingest:weather`
depends on `ingest`-independent state: a farm must exist and have resolved a
district, which happens when a boundary is saved through the API.

Both are idempotent — they upsert on the unique constraints from `0002`, so
re-running a day cannot duplicate observations.

## 6. Stage 2.5b — the avatar

**The state machine was not touched.** `avatarMachine.ts` is the same pure
reducer Phase 1 wrote. `AvatarContext.tsx` swapped its timers for the real loop:

```text
hold mic -> expo-audio records -> POST /ai/transcribe -> POST /ai/chat -> speak
```

`demoScript.ts` is gone, renamed to `questions.ts`. The five suggestion chips
survive — a farmer facing a microphone needs to know what they may ask — but
their hard-coded answers were deleted. The chips now send their question to the
real assistant like a spoken one.

### Providers

| Concern | Provider | Key |
|---|---|---|
| Speech to text | Sarvam AI | `SARVAM_API_KEY`, server-side |
| Language model | Google Gemini (`gemini-2.5-flash`) | `GEMINI_API_KEY`, server-side |

Gemini replaced the planned Anthropic model at the user's request. Only
`backend/src/ai/llm.service.ts` knows which provider is in use; the controller,
the app and the prompt builder are all provider-agnostic.

`grep -rniE "gemini|anthropic|sarvam|api.key" mobile/src/` returns nothing.

### The prompt is the safety control

`backend/src/ai/prompt.ts` is pure and has 15 tests, because it is the only
thing standing between a language model and a farmer acting on an invented
mandi price. It does two jobs:

1. States every fact it was given, each with its source and date, and marks
   prices and weather explicitly as *past observations, not forecasts*.
2. Names what V1 cannot do — predictions, sell/wait advice, buyers, offers,
   payments, crop health — and requires it to say the service is not connected.

`context.service.ts` assembles those facts through the farmer's own token, so
RLS scopes them exactly as it does for Home. This is **not** tool calling: it is
the same data the Home screen is already displaying, handed to the model so it
can answer honestly instead of refusing everything. The agent that can go and
fetch more is Phase 5.

### The 3D avatar

WebView + three.js, not expo-gl + react-three-fiber. Full GLTF support with no
native GL bridging and no version coupling to the Expo SDK, and the scene can be
opened in a desktop browser to debug.

One refinement on the approved plan: the plan put the animation controllers
inside the WebView. They live in `components/avatar/animation/` instead, so Jest
can reach them. The split is cleaner anyway — TypeScript makes the per-state
*decisions*, the scene executes them and owns the per-frame work (breathing,
blinking, jaw, cross-fades). Nothing crosses the bridge per frame.

Gestures are chosen deterministically from the reply's text, never randomly
(§7). A refusal gets an open, empty hand; a quoted figure gets a point. The
model is never asked what to do with the body (§5) — that would make the
avatar's gestures one more thing it could hallucinate.

**The mouth movement is not lip sync, and must not be described as one.** There
is no audio in this phase, so there is nothing to synchronise to. The scene
oscillates the jaw at a speaking cadence. `lipsync/` exists so real viseme
frames can replace that when TTS arrives (§6).

### Still to do before the 3D avatar renders

The model file is not in the repository. `components/avatar/avatar3d/assets.ts`
documents the drop-in: a three.js browser build and a rigged GLB (a Ready Player
Me half-body export satisfies it) into `mobile/assets/avatar3d/`, then uncomment
two requires.

Until then `Avatar3D` reports itself unavailable and `AvatarStage` shows the
Phase 1 photograph. That fallback is permanent for the session and also covers a
missing WebGL context or a crashed render process — **the avatar must never be a
blank rectangle.**

### What was deliberately left out

Per §9: no AI agent, no tool calling, no text-to-speech, no audio-driven
visemes, no 22-language production voice stack. The reply is displayed, not
spoken.

## 7. Two bugs the tests found

Worth recording, because both were invisible by inspection:

**A denied microphone left the avatar silent.** `avatarMachine` ignores `FAIL`
while idle — correct in Phase 1, where failure could only happen mid-conversation.
A permission denial happens while still idle, so the error never surfaced. Fixed
in the driver, not the machine: `START_LISTENING` is now dispatched optimistically
before the recorder is awaited, which also gives the farmer feedback on the tap.

**A test contradicted the Phase 1 design.** An interruption test assumed the
farmer could cut in during `thinking`. They cannot — the mic button is disabled
and labelled "One moment…". The design was kept and the test rewritten to cover
the stale-reply guard through `close()` instead.

## 8. Test counts

```text
Phase 2 baseline    backend  58    mobile 141
After stage 2.5a    backend 102    mobile 160
After stage 2.5b    backend 126    mobile 195
```

## 9. Where Phase 3 attaches

`market_prices`, `weather` and `farm_crops` now carry real rows, so Phase 3 adds
intelligence rather than a data foundation. The Home market card and the Market
screen are still in their empty states by design — they were drawn around a
*predicted* price and a sell/wait recommendation, which is exactly what Phase 3
brings.

For the avatar, Phase 5 replaces `llm.service.ts` with the agent and adds TTS
behind the existing `lipsync/` seam. The UI does not need to know which answered.
