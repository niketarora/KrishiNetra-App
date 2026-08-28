# PHASE 2.5 — Market Data + Weather + Avatar Intelligence V1 + Home Dashboard Expansion

## Goal

Phase 2.5 is an intermediate integration phase between the completed Phase 2 backend foundation and Phase 3 ML / market intelligence.

The purpose of this phase is to make the application substantially more useful with **real agricultural data** and to turn the existing Avatar UI into a first working conversational interface, without implementing the Phase 3 ML models or the final AI Agent architecture.

Phase 2.5 must build on the existing Phase 1 and Phase 2 implementation rather than replacing it.

### Phase 2.5 Scope

```text
Home Dashboard Expansion
        +
Real Market Price Ingestion
        +
Real Weather Updates
        +
AI Avatar Intelligence V1
```

---

# 1. Home Dashboard Expansion

Add two additional information blocks to the existing Home dashboard.

## 1.1 Crop Type

Add a block showing the **type of crop currently associated with the farmer's field**.

The crop value must come from real application data.

The preferred source is the farmer's `farm_crops` record and the referenced `crops` catalogue.

Do not display a fabricated crop name.

If no crop has been recorded yet:

```text
—
Crop not added yet
```

or an equivalent existing empty-state treatment should be shown.

The block should use the existing KrishiNetra visual language and should not introduce a generic card style that conflicts with the current UI.

## 1.2 Second New Home Block

Add one additional agricultural information block alongside the crop block.

The second block should be designed so it can display a useful real field/agricultural value without introducing fake data.

Its value should come from an available backend/data source. If the required data is not yet available, it must use the project's established unavailable/empty-state treatment rather than a sample value.

The final layout should remain consistent with the existing Home dashboard.

### Home rule

The Phase 2.5 Home screen must never use plausible-looking placeholder numbers or agricultural values as if they were real.

---

# 2. Real Market Price Ingestion

Phase 2 created the `market_prices` table and `/api/v1/market-prices` endpoint, but the table is intentionally empty.

Phase 2.5 connects a **real market-price data source** and ingests verified market observations.

## 2.1 Data Flow

```text
Real Market Data Source
        ↓
Backend ingestion service
        ↓
Validation / normalization
        ↓
Supabase market_prices
        ↓
/api/v1/market-prices
        ↓
Mobile Home / Market UI
```

The mobile application must not call the external market provider directly.

All external API credentials remain on the backend.

## 2.2 Data Requirements

Ingest only real observations containing, where available:

```text
mandi
crop
variety
grade
price_date
min_price
max_price
modal_price
arrivals
source
```

The existing Phase 2 schema remains the source of truth.

`arrivals_tonnes` remains part of `market_prices`; do not reintroduce a separate
`market_arrivals` table.

## 2.3 Source Verification

Use a legitimate, verifiable market-data source.

The implementation must:

- Record the source for every ingested observation.
- Preserve the observation date.
- Normalize units consistently.
- Map incoming mandi/crop identifiers to existing reference records.
- Reject invalid price ranges.
- Never generate synthetic market prices.
- Never fill missing values with guessed values.

If the external source is unavailable, the application must continue to show the existing "not connected/unavailable" state rather than fabricate data.

## 2.4 Ingestion Architecture

The ingestion mechanism should be isolated from farmer-facing request handling.

Recommended structure:

```text
backend/src/
├── ingestion/
│   ├── market/
│   │   ├── marketSource.ts
│   │   ├── marketNormalizer.ts
│   │   └── marketIngestion.ts
│   └── weather/
│       ├── weatherSource.ts
│       ├── weatherNormalizer.ts
│       └── weatherIngestion.ts
```

The ingestion service may use the Supabase service-role client because it writes trusted reference data.

The service-role key must never be exposed to the mobile app and must never be used to read farmer-owned rows on behalf of a farmer.

## 2.5 API Behavior After Ingestion

The existing endpoint:

```text
GET /api/v1/market-prices?crop=&mandi=&from=&to=
```

should begin returning real observations once ingestion has populated the table.

Do not change the Phase 2 response envelope.

Do not expose raw provider-specific response formats to the mobile application.

---

# 3. Real Weather Updates

Phase 2 created the `weather` table but intentionally left it empty.

Phase 2.5 connects a real weather source and begins storing verified weather observations.

## 3.1 Data Flow

```text
Real Weather Provider
        ↓
Backend weather service
        ↓
Validation / normalization
        ↓
Supabase weather
        ↓
/api/v1/weather
        ↓
Home / Field UI
```

The mobile app must never contain the weather provider's secret API key.

## 3.2 Weather Data

The existing Phase 2 `weather` table stores **observed weather**:

```text
district
state
observed_on
temperature_c
rainfall_mm
humidity_pct
source
```

Phase 2.5 must preserve the distinction between observed and forecast data.

Do not store forecast values in the observed-weather table.

If forecasts are required later, create a separate forecast table as defined by the later ML/data architecture.

## 3.3 Farm Weather Resolution

The existing `/api/v1/weather?farmId=` endpoint may use the farmer's farm information to determine the relevant district/location according to the verified provider's supported geographic resolution.

Do not guess a district from incomplete coordinates.

If a reliable location cannot be resolved, return the established unavailable state.

## 3.4 Weather UI

The existing Home weather block can now display real weather data.

The UI must show:

- Current/latest available observation.
- Appropriate unit.
- Observation date/time where useful.
- Source where appropriate.

If no verified weather data is available:

```text
—
Weather data unavailable
```

Do not show fake temperatures, rainfall or humidity.

---

# 4. AI Farmer Avatar — Intelligence V1

Phase 1 already implemented the complete Avatar UI and five-state avatar machine.

Phase 2.5 turns that visual Avatar into a first working conversational system.

## 4.1 Scope of Version 1

Version 1 is intentionally limited to:

```text
Farmer speaks
      ↓
Speech-to-Text
      ↓
Regional-language text
      ↓
LLM
      ↓
Text response
```

The AI Agent/tool-calling architecture is NOT implemented in Phase 2.5.

The Avatar does not yet have unrestricted access to every KrishiNetra API.

That capability belongs to the later AI Agent phase.

## 4.2 Speech-to-Text

Implement microphone input and speech recognition.

The speech recognition layer should:

- Capture farmer speech.
- Convert speech to text.
- Preserve the detected/selected regional language.
- Pass the resulting text to the LLM layer.
- Handle microphone permission errors.
- Handle recognition errors.
- Handle no-speech/timeouts gracefully.

The implementation should be designed so the supported language set can grow toward the project's later approximately 22-language target.

Do not hard-code the final 22-language architecture into this phase if the selected STT provider does not require it.

## 4.3 Regional Language Flow

The selected application language should influence the speech/response experience.

The intended V1 flow is:

```text
Farmer speaks in regional language
        ↓
STT
        ↓
Text in that language
        ↓
LLM
        ↓
Response text in the appropriate farmer language
```

Do not unnecessarily translate the text into English before sending it to the LLM if the selected LLM can directly handle the regional language.

If a provider requires an intermediate language for reliable operation, isolate that translation step behind a service interface so it can be replaced later.

## 4.4 LLM Integration

For Version 1, the recognized text is sent directly to an LLM.

The LLM should receive a controlled system prompt establishing that it is the KrishiNetra farmer companion.

At this stage, the LLM is primarily a conversational system.

It must not claim to have retrieved live market, weather, farm, buyer, transaction, or ML data when it has not.

For application-specific factual questions that V1 cannot yet retrieve, the response should clearly state that the required service is not connected yet.

The LLM API key must remain on the backend.

Recommended flow:

```text
React Native
      ↓
Node.js + Express
      ↓
LLM service
      ↓
Response text
      ↓
React Native Avatar
```

The mobile app must not expose the LLM secret.

## 4.5 Avatar Animation System

The current static avatar visual should be upgraded to a **3D rigged farmer avatar**.

Use the first avatar implementation approach selected for the project:

```text
3D Farmer Avatar
+
Humanoid skeleton
+
Facial controls / blendshapes
+
Eye controls
+
Jaw / mouth controls
+
Hand / arm bones
+
Head / neck bones
+
Animation clips
```

The preferred asset format is:

```text
GLB / GLTF
```

The model should be selected with animation and facial control capability in mind.

A visually attractive model without a usable facial/animation rig should not be treated as sufficient.

## 4.6 Rendering

Integrate the 3D avatar into the existing React Native / Expo Avatar interface.

The existing Avatar popup/window and surrounding UI should be preserved.

The 3D renderer should replace the static visual portion rather than forcing a redesign of the whole Avatar screen.

The implementation must remain compatible with the existing:

```text
AvatarContext
avatarMachine
AvatarOverlay
```

architecture.

## 4.7 Avatar States

Keep the existing five logical states:

```text
IDLE
LISTENING
THINKING
SPEAKING
ERROR
```

Each state should now drive the avatar animation.

### IDLE

```text
breathing
subtle body movement
blinking
small eye movement
natural neutral pose
```

### LISTENING

```text
eye contact
subtle head movement
occasional blink
attentive expression
```

### THINKING

```text
small head movement
slight gaze change
thinking expression
subtle body movement
```

### SPEAKING

```text
mouth movement
head movement
eye movement
blinking
hand gestures
facial expression
```

### ERROR

```text
neutral/reassuring expression
small head movement
clear error UI state
```

Animations should be subtle and layered rather than continuously random.

---

# 5. Avatar Animation Architecture

Do not make the LLM directly control bones or animations.

Use an independent animation controller.

Recommended structure:

```text
mobile/src/
└── components/avatar/
    ├── AvatarOverlay
    ├── Avatar3D
    └── animation/
        ├── animationController
        ├── gestureController
        ├── headMotion
        ├── facialController
        └── idleController
```

And for future lip-sync:

```text
mobile/src/
└── components/avatar/
    └── lipsync/
        ├── visemeMapper
        └── lipSyncController
```

The LLM response should remain data.

For example:

```text
LLM
 ↓
response text
 ↓
Avatar controller
 ↓
speaking animation
```

Do not ask the LLM to output commands such as:

```text
move_head
move_hand
blink
```

The deterministic animation controller owns those decisions.

---

# 6. Avatar Mouth Movement in Version 1

Phase 2.5 must implement a **speaking mouth animation** so the avatar no longer appears completely static while a response is being presented.

However, true phoneme/viseme-level lip synchronization depends on having speech audio and timing information.

Because Phase 2.5 Version 1 is explicitly:

```text
STT → regional-language text → LLM → text response
```

do not claim to have true audio-synchronized lip sync if TTS has not yet been integrated.

Implement the architecture so the current speaking animation can later be replaced by:

```text
TTS audio
      +
viseme/phoneme timing
      ↓
lipSyncController
      ↓
facial blendshapes
```

without changing the Avatar UI.

True TTS-driven lip synchronization belongs to the later Avatar intelligence phase.

---

# 7. Hand, Head and Facial Movement

The Avatar should use a small library of controlled gestures.

Examples:

```text
idle
talking
explain
agree
thinking
greeting
open_hand
point
```

Gestures should be selected by the deterministic animation controller based on the Avatar state and conversation context where appropriate.

Do not make gestures fully random.

Head movement should remain subtle:

```text
small nods
small left/right turns
slight gaze shifts
occasional natural repositioning
```

Facial animation should include at minimum:

```text
blink
eye movement
neutral expression
speaking expression
```

If the selected model supports additional blendshapes, use them for more natural expressions.

---

# 8. Avatar Service Architecture

The Avatar implementation should introduce service boundaries so Version 2 can replace components without rewriting the UI.

Recommended conceptual services:

```text
SpeechToTextService
LLMService
AvatarAnimationController
```

Version 1:

```text
SpeechToTextService
        ↓
LLMService
        ↓
AvatarAnimationController
```

Later Version 2:

```text
SpeechToTextService
        ↓
AI Agent
        ↓
KrishiNetra Tools / APIs
        ↓
LLM
        ↓
TextToSpeechService
        ↓
AvatarAnimationController
```

The current Avatar UI should not need to know whether the answer came from direct LLM processing or the future AI Agent.

---

# 9. Version 2 — Explicitly Deferred

Do NOT implement the following in Phase 2.5:

```text
AI Agent
API tool calling
Farm data tools
Market tools
Weather tools
Price prediction tools
Selling recommendation tools
Buyer tools
Offer tools
Transaction tools
Net-realisation tools
Text-to-Speech
Real-time voice conversation
Audio-driven viseme synchronization
Full approximately 22-language production voice architecture
```

These belong to the later Avatar intelligence phase.

The Phase 2.5 implementation must only create clean interfaces that allow these systems to be attached later.

---

# 10. Security Requirements

The following secrets must remain backend-only:

```text
LLM API key
Market provider API keys
Weather provider API keys
Supabase service-role key
```

The mobile application may contain only public/client-safe configuration.

Never put provider secrets in:

```text
React Native source
EXPO_PUBLIC_* variables
Git
```

All external requests requiring secrets should pass through the Node.js + Express backend.

---

# 11. Testing Requirements

## Market Ingestion

```text
[ ] real provider response is normalized correctly
[ ] invalid prices are rejected
[ ] min <= modal <= max is enforced
[ ] source is stored
[ ] observation date is preserved
[ ] duplicate observations do not create duplicate rows
[ ] missing provider values are not fabricated
[ ] provider failure does not produce fake market data
```

## Weather

```text
[ ] provider response is normalized
[ ] rainfall cannot become negative
[ ] humidity remains between 0 and 100
[ ] observed date is preserved
[ ] source is stored
[ ] forecast data is not written to the observed-weather table
[ ] provider failure returns an honest unavailable state
```

## Avatar

```text
[ ] microphone permission flow works
[ ] speech recognition starts
[ ] speech recognition stops
[ ] recognized regional-language text reaches the backend
[ ] LLM response is returned safely
[ ] LLM failures enter ERROR state
[ ] no API key reaches the mobile client
[ ] IDLE animation works
[ ] LISTENING animation works
[ ] THINKING animation works
[ ] SPEAKING animation works
[ ] ERROR animation works
[ ] mouth animation runs during speaking
[ ] blinking works
[ ] head movement works
[ ] hand gestures work
[ ] AvatarContext/avatarMachine architecture remains intact
```

## Existing Tests

All existing Phase 1 and Phase 2 tests must remain green.

The Phase 2 baseline is:

```text
Backend: 51 tests
Mobile: 141 tests
```

New tests must be added without removing existing coverage.

---

# 12. Phase 2.5 Definition of Done

```text
[ ] Home dashboard has the new crop block
[ ] Home dashboard has the second new agricultural block
[ ] New blocks use real data or honest empty states
[ ] Real market data provider is connected
[ ] Market ingestion is validated
[ ] market_prices contains real verified observations
[ ] /api/v1/market-prices returns real data when available
[ ] no fabricated market prices exist
[ ] Real weather provider is connected
[ ] weather contains verified observations
[ ] /api/v1/weather returns real weather when available
[ ] no fabricated weather values exist
[ ] observed and forecast weather remain separate
[ ] Avatar accepts microphone input
[ ] STT converts farmer speech to regional-language text
[ ] Regional-language text reaches the LLM
[ ] LLM response reaches the Avatar UI
[ ] LLM secrets remain backend-only
[ ] Static Avatar visual is replaced by a rigged 3D farmer avatar
[ ] IDLE animation works
[ ] LISTENING animation works
[ ] THINKING animation works
[ ] SPEAKING animation works
[ ] ERROR animation works
[ ] mouth movement works during speaking
[ ] head movement works
[ ] blinking/eye movement works
[ ] hand gestures work
[ ] AvatarContext/avatarMachine remains the control architecture
[ ] no AI Agent/tool calling is implemented
[ ] no TTS is implemented
[ ] no true audio/viseme lip-sync is claimed
[ ] all Phase 1 tests remain green
[ ] all Phase 2 tests remain green
[ ] new Phase 2.5 tests pass
[ ] documentation is updated
```

---

# 13. What Phase 3 Now Attaches To

After Phase 2.5:

```text
market_prices
      ↓
Phase 3 ML price prediction
      ↓
predicted prices
      ↓
selling recommendation
```

```text
weather observations
      +
future forecast table
      ↓
Phase 3 market / agricultural intelligence
```

```text
farm_crops
      +
market_prices
      +
weather
      ↓
Phase 3 ML prediction request
```

The Home and Market UI already have real data paths, so Phase 3 primarily adds intelligence rather than replacing the existing data foundation.

The Avatar also remains ready for the later architecture:

```text
STT
 ↓
AI Agent
 ↓
KrishiNetra APIs / tools
 ↓
LLM
 ↓
TTS
 ↓
Audio + visemes
 ↓
3D Farmer Avatar
```

The Phase 2.5 Avatar implementation should therefore be treated as the **V1 conversational and animation foundation**, not the final AI assistant.
