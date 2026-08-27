# KrishiNetra 2.0 — Implementation Plan + Claude Master Prompt

## 1. Current Development Strategy

Do **not** implement the complete KrishiNetra application now.

The complete product is divided into 5 phases. Each phase must produce a working, testable result.

ML models will be developed separately by the project team. Once a model is ready, its API/contract will be provided to Claude for integration. Claude should not attempt to invent or train the project's final ML models unless explicitly requested.

The AI Avatar's actual intelligence is intentionally delayed. **Phase 1 includes the complete Avatar UI only.**

---

# 2. Technology Stack

## Frontend

- React Native
- JavaScript/TypeScript as appropriate for the existing project setup
- Mobile-first design
- Android-first

## Backend

- Node.js
- Express.js
- JavaScript

## Database / Authentication / Storage

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage

## ML

Developed separately by the project team:

- Python
- FastAPI
- XGBoost / LightGBM or final selected model
- Separate ML service/API

## Future AI

- LLM / AI Agent
- Speech-to-Text
- Text-to-Speech
- Real-time Farmer Avatar

These are later phases.

---

# 3. Five-Phase Roadmap

## PHASE 1 — UI Foundation + Authentication + Farm Mapping + Avatar UI

### Goal

Create the complete visual foundation of the application and make the first user journey actually work.

### Implement now

```text
Login / Register
      ↓
Supabase Email + Password Auth
      ↓
Farmer Onboarding
      ↓
Farm Mapping
      ↓
Draw Land
      ↓
Calculate Area
      ↓
Save Farm
      ↓
Home
```

Also complete:

```text
AI Farmer Avatar UI
```

### Phase 1 Requirements

#### Authentication

Use **Supabase Auth with email and password**.

Required:

- Register with email/password.
- Login with email/password.
- Logout.
- Persist authentication session.
- Handle incorrect credentials.
- Handle registration errors.
- Protect authenticated screens.
- Redirect authenticated users away from login.
- Store farmer profile/farm ownership using the authenticated Supabase user ID.

Do NOT store raw passwords in a custom database table.

#### Farm Mapping

The farmer should:

1. Open the map.
2. See the map interface.
3. Draw a polygon around their land.
4. Add/remove/edit points.
5. Calculate area.
6. Show area in a farmer-friendly format.
7. Confirm the boundary.
8. Save the boundary to Supabase.
9. Navigate to Home.

The farm record should be linked to the authenticated user.

Conceptual data:

```text
farms
├── id
├── user_id
├── boundary
├── area_sq_meters
├── area_acres
├── area_hectares
├── centroid
└── created_at
```

Do not over-engineer the farm schema in Phase 1.

#### Home

The Phase 1 Home screen should establish the final visual direction.

It should show:

- Farmer greeting/profile area.
- Farm summary.
- Saved land area.
- Empty/future sections for crop and market intelligence.
- Clear navigation to future features.
- AI Avatar entry point.

Do not implement live market/ML functionality yet.

#### AI Farmer Avatar UI

The Avatar UI must be completed visually in Phase 1.

Implement:

- Avatar window/pop-up.
- Farmer avatar visual.
- Open/close interaction.
- Listening state.
- Thinking state.
- Speaking state.
- Idle state.
- Error state.
- Microphone button.
- Conversation area.
- Voice activity indicator.
- Loading animation.
- Placeholder/demo response state.

The UI should make it clear that this will eventually become a real-time conversational farmer.

Actual STT, TTS, LLM, API tools, and real-time avatar intelligence are NOT required in Phase 1.

### Phase 1 Deliverable

A working React Native application where:

```text
Register
→ Login
→ Farm Mapping
→ Draw Land
→ Calculate Area
→ Save Farm
→ Home
```

and the complete AI Avatar UI can be opened from the application.

---

# PHASE 2 — Backend Foundation + Agricultural Data

### Goal

Build the backend and database foundation for the future intelligence layer.

Implement:

- Node.js + Express.
- Supabase database integration.
- Farmer/farm APIs.
- Crop APIs.
- Market data schema.
- Weather data schema.
- Clean service architecture.
- API authentication.
- Row Level Security.

Potential tables:

```text
users
farms
crops
mandis
market_prices
msp
market_arrivals
weather
buyers
buyer_requirements
```

Do not implement all buyer/transaction functionality yet unless explicitly requested.

### Deliverable

The React Native app communicates with the backend and Supabase through a clean architecture.

---

# PHASE 3 — ML Integration + Market Intelligence

### Goal

Integrate the ML models developed separately by the project team.

The ML team will provide:

- Model.
- Input schema.
- Output schema.
- Model version.
- Python API or inference endpoint.
- Required preprocessing.
- Expected units.
- Confidence/output information.

Claude should integrate the provided contract, not invent a different model interface.

### ML Components

#### 1. Price Prediction

Input example:

```text
date
state
district
mandi
crop
variety
min_price
max_price
modal_price
arrivals
```

Future features may include:

```text
temperature
rainfall
humidity
MSP
season
demand
supply
```

Output:

```text
predicted_price_1d
predicted_price_3d
predicted_price_7d
confidence
model_version
timestamp
```

#### 2. Selling Recommendation

Initially:

```text
current price
predicted price
weather risk
arrival trend
demand
MSP
storage
transport
```

Output:

```text
SELL NOW
WAIT
SELL PARTIALLY
```

with:

```text
score
reason
confidence
timestamp
```

#### 3. Buyer Matching

Initially weighted ranking.

Later integrate the ML ranking model.

### Market UI

Add:

- Current price.
- MSP.
- Historical trend.
- Predicted price.
- Market score.
- Selling recommendation.
- Recommendation explanation.

### Deliverable

A farmer can view useful market intelligence based on real data and integrated ML services.

---

# PHASE 4 — Market Linkage + Transactions

### Goal

Turn market intelligence into actual market linkage.

Implement:

## Buyers

- Buyer profiles.
- Verification status.
- Buyer requirements.
- Crop requirements.
- Quantity.
- Quality.
- Price.
- Location.
- Payment terms.
- Reliability.

## Buyer Matching

Start with weighted ranking.

Inputs:

```text
crop
quantity
quality
price
distance
reliability
pickup
payment history
```

## Crop Lots

Farmer creates:

```text
crop
quantity
quality
expected_price
location
available_date
photos
```

## Offers

Buyer can:

- Make offer.
- Specify quantity.
- Specify price.
- Specify pickup.
- Specify payment terms.

Farmer can:

- Accept.
- Reject.
- Counter.

## Logistics

- Distance.
- Transport.
- Cost.
- Pickup.
- Storage.

## Transactions

```text
Lot Created
→ Offer
→ Accepted
→ Pickup
→ Delivery
→ Payment
```

Track transaction status.

### Deliverable

A farmer can move from:

```text
Market Recommendation
→ Buyer
→ Lot
→ Offer
→ Transaction
```

---

# PHASE 5 — AI Farmer Avatar Intelligence

### Goal

Turn the Phase 1 Avatar UI into a real-time AI assistant.

Architecture:

```text
Farmer Voice
      ↓
Speech-to-Text
      ↓
AI Agent / LLM
      ↓
KrishiNetra Tools
      ↓
Backend APIs
      ↓
Supabase / Market APIs / ML
      ↓
Verified Result
      ↓
LLM Response
      ↓
Text-to-Speech
      ↓
Avatar
```

### AI Tools

Possible tools:

```text
get_farmer_data()
get_farm_data()
get_crop_data()
get_market_price()
get_weather()
get_price_prediction()
get_selling_recommendation()
find_buyers()
get_offers()
get_transaction_status()
get_net_realisation()
```

### Voice

Target approximately 22 Indian languages.

Support:

- Speech-to-text.
- Language detection.
- Text-to-speech.
- Mixed-language conversations.
- Low-latency interaction.

### Avatar

The Phase 1 visual Avatar should now become functional:

```text
Idle
→ Listening
→ Thinking
→ Speaking
```

with:

- Lip synchronization.
- Natural voice.
- Facial expressions.
- Real-time response.

### Critical AI Rule

The AI must never invent:

- Live prices.
- MSP.
- Weather.
- Buyer offers.
- Transaction status.
- Payment status.
- ML predictions.

It must retrieve application-specific values from trusted backend sources.

---

# 4. Project Architecture

```text
                    React Native App
                           │
                           ▼
                    Node.js + Express
                           │
          ┌────────────────┼─────────────────┐
          ▼                ▼                 ▼
       Supabase        ML Services      External APIs
          │                │                 │
          └────────────────┼─────────────────┘
                           ▼
                      AI Agent
                           │
                    STT / TTS / Avatar
```

The mobile application should not directly expose secret API keys.

The backend should be the abstraction layer for external APIs and ML services.

---

# 5. Suggested Repository Structure

```text
krishinetra/
│
├── mobile/
│   └── React Native application
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── config/
│   └── server.js
│
├── ml/
│   └── integration contracts / documentation only
│
├── docs/
│   ├── PRD.md
│   └── IMPLEMENTATION.md
│
└── README.md
```

The ML models themselves may live in a separate repository if the ML team prefers.

---

# 6. Phase 1 Database Setup

Only create what Phase 1 actually needs.

Minimum:

```text
auth.users
farms
```

Optional:

```text
profiles
```

Suggested `farms` fields:

```text
id
user_id
boundary
area_sq_meters
area_acres
area_hectares
centroid_lat
centroid_lng
created_at
updated_at
```

Use Supabase Row Level Security so a farmer can only access their own farms.

---

# 7. Phase 1 Navigation

Suggested structure:

```text
Login / Register
      ↓
Onboarding / Farm Setup
      ↓
Home
```

Once inside the application, establish navigation for future modules without implementing them fully.

Possible future structure:

```text
Home
Farm
Market
History
Profile
```

The AI Avatar should NOT occupy a bottom-navigation slot.

Use an independent floating/entry action.

---

# 8. UI Development Rules

The attached UI ZIP is the primary visual reference.

Before changing anything:

1. Inspect the entire ZIP.
2. Understand the existing screens.
3. Understand the existing navigation.
4. Identify reusable components.
5. Identify colors, typography, spacing and visual patterns.
6. Identify current assets.
7. Preserve the existing design language.

Do not replace the UI with a generic template.

If a current design conflicts with the new product requirements, modify only the relevant part.

---

# 9. Phase 1 Completion Checklist

```text
[ ] React Native project runs
[ ] Supabase configured
[ ] Email registration works
[ ] Email login works
[ ] Session persistence works
[ ] Logout works
[ ] Protected screens work
[ ] Farmer reaches farm setup
[ ] Map loads
[ ] Polygon can be drawn
[ ] Polygon can be edited
[ ] Area is calculated
[ ] Farm can be confirmed
[ ] Farm is saved to Supabase
[ ] Farmer reaches Home
[ ] AI Avatar UI opens
[ ] Avatar idle state works
[ ] Avatar listening state works
[ ] Avatar thinking state works
[ ] Avatar speaking state works
[ ] Avatar error state works
[ ] Microphone interaction is visually implemented
[ ] No real AI/voice dependency is required yet
```

---

# 10. Claude Master Prompt

Use the following as the main prompt when giving Claude the UI ZIP and project context:

---

You are helping me build **KrishiNetra 2.0**, an SIH 2026 project for Problem Statement 26132:

**"Strengthening market linkages and price discovery for farmers."**

I am attaching the current KrishiNetra UI ZIP.

## FIRST TASK — UNDERSTAND THE EXISTING PROJECT

Before modifying or generating code:

1. Inspect the entire attached ZIP.
2. Understand the existing UI.
3. Understand the existing screens.
4. Understand navigation.
5. Understand components.
6. Understand assets.
7. Understand the current design system.
8. Identify what is already implemented.
9. Do not unnecessarily redesign existing screens.
10. Do not immediately start implementing the entire product.

First, give me a concise assessment of the existing project and explain how it maps to the KrishiNetra product described below.

---

## PRODUCT CONTEXT

KrishiNetra 2.0 is an AI-powered agricultural market intelligence and market-linkage platform.

The long-term farmer journey is:

```text
Authentication
→ Farm Mapping
→ Agricultural Data
→ Crop & Yield
→ Market Prices
→ Weather / Supply / Demand
→ Selling Recommendation
→ Buyer Discovery
→ Buyer Matching
→ Crop Lot
→ Offers / Negotiation
→ Logistics / Storage
→ Transaction / Payment
```

The long-term differentiator is:

```text
Farm-specific intelligence
→ Price Prediction
→ Sell / Wait Recommendation
→ Best Market
→ Best Buyer
→ Net Realization
→ Transaction Support
→ AI Farmer Avatar
```

This is NOT simply a mandi-price application.

---

## TECHNOLOGY STACK

Use:

### Frontend

**React Native**

Do not use Flutter.

### Backend

- Node.js
- Express.js
- JavaScript

### Database / Auth / Storage

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage

### ML

The ML models will be developed separately by me/team.

You will later receive the model/API contract and integrate it.

Do NOT attempt to build the final ML models unless I explicitly ask you to.

### Future AI

- LLM / AI Agent
- Speech-to-Text
- Text-to-Speech
- Real-time Farmer Avatar

These will be implemented later.

---

# DEVELOPMENT MUST BE DIVIDED INTO 5 PHASES

Do NOT implement the entire application now.

## PHASE 1 — UI + AUTH + FARM MAPPING + AVATAR UI

This is the current phase.

Implement only:

```text
Register
→ Login
→ Farmer Setup
→ Farm Mapping
→ Draw Land
→ Calculate Area
→ Save Farm
→ Home
```

### Authentication

Use **Supabase email/password authentication**.

Requirements:

- Email registration.
- Password registration.
- Email/password login.
- Logout.
- Persistent session.
- Authentication errors.
- Protected screens.
- Authenticated user ID used to associate farm data.

Important:

**Do not create a custom password table.**

Supabase Auth must handle passwords securely.

---

### Farm Mapping

The farmer must be able to:

1. Open a map.
2. Draw their land boundary.
3. Add polygon points.
4. Edit/remove points.
5. Close the polygon.
6. Calculate area.
7. Display area.
8. Confirm the land.
9. Save it to Supabase.
10. Navigate to Home.

Use a simple Phase 1 farm schema:

```text
farms
├── id
├── user_id
├── boundary
├── area_sq_meters
├── area_acres
├── area_hectares
├── centroid_lat
├── centroid_lng
├── created_at
└── updated_at
```

Use Row Level Security.

A farmer must only be able to access their own farm.

---

### Home

After the farmer confirms the land, they should reach the Home screen.

Home should be visually aligned with the existing UI.

For Phase 1, do NOT implement the complete market/ML dashboard.

Use:

- Farmer greeting.
- Farm summary.
- Land area.
- Future crop/market sections as placeholders or empty states.
- Navigation structure for future features.
- AI Avatar entry point.

---

# AI FARMER AVATAR — UI MUST BE COMPLETE IN PHASE 1

Even though the actual AI implementation is later, the **Avatar UI should be completed now**.

The Avatar should have:

- Full farmer avatar.
- Pop-up / dedicated interaction window.
- Idle state.
- Listening state.
- Thinking state.
- Speaking state.
- Error state.
- Microphone control.
- Conversation area.
- Voice activity indicator.
- Loading state.
- Close/minimize interaction.

The Avatar should look like a farmer who can eventually talk with the user in real time.

Do NOT implement actual STT, TTS, LLM or real-time AI yet.

Use mock/demo states where necessary.

The visual design should make future integration straightforward.

---

# PHASE 2 — BACKEND FOUNDATION

Later we will implement:

- Node.js + Express.
- Supabase integration.
- Farmer APIs.
- Farm APIs.
- Crop APIs.
- Market data schema.
- Weather schema.
- Authentication middleware.
- RLS.
- API architecture.

---

# PHASE 3 — ML + MARKET INTELLIGENCE

ML models are developed separately by me.

There will be three major intelligence components:

### Model 1 — Price Prediction

Predict:

- 1-day price
- 3-day price
- 7-day price

Initial input:

```text
date
state
district
mandi
crop
variety
min_price
max_price
modal_price
arrivals
```

Later:

```text
temperature
rainfall
humidity
MSP
season
demand
supply
```

### Model 2 — Selling Recommendation

Output:

```text
SELL NOW
WAIT
SELL PARTIALLY
```

### Model 3 — Buyer Matching

Rank buyers based on:

```text
crop
quantity
quality
price
distance
reliability
pickup
payment history
logistics
```

The models will be supplied separately.

When integrating them:

- Respect the supplied API contract.
- Do not invent input/output fields.
- Do not change the model logic unnecessarily.
- Keep the ML service separate from Node.js.
- Let Node.js act as the application abstraction layer.

---

# PHASE 4 — MARKETPLACE + TRANSACTIONS

Later implement:

- Verified buyers.
- Buyer requirements.
- Buyer matching.
- Crop lots.
- Offers.
- Counter offers.
- Logistics.
- Storage.
- Orders.
- Payment status.
- Transaction history.
- Grievances.

---

# PHASE 5 — AI FARMER AVATAR INTELLIGENCE

Later turn the Phase 1 Avatar UI into a real AI system.

Architecture:

```text
Farmer Voice
→ Speech-to-Text
→ AI Agent / LLM
→ KrishiNetra Backend Tools
→ Supabase / External APIs / ML
→ Response
→ Text-to-Speech
→ Avatar
```

The AI should eventually support approximately 22 Indian languages.

Possible tools:

```text
get_farmer_data()
get_farm_data()
get_crop_data()
get_market_price()
get_weather()
get_price_prediction()
get_selling_recommendation()
find_buyers()
get_offers()
get_transaction_status()
get_net_realisation()
```

The AI must NEVER invent:

- Market prices.
- MSP.
- Weather.
- ML predictions.
- Buyer offers.
- Transaction status.
- Payment status.

Application-specific data must come from trusted backend sources.

---

# CURRENT TASK IS STRICTLY PHASE 1

Do NOT:

- Build the ML models.
- Build market APIs.
- Build buyer marketplace.
- Build transactions.
- Build logistics.
- Build payment systems.
- Build actual AI agent.
- Build STT.
- Build TTS.
- Build real-time avatar intelligence.

Only build:

```text
React Native UI
+
Supabase Email/Password Auth
+
Farm Mapping
+
Farm Saving
+
Home
+
Complete AI Avatar UI
```

---

# IMPORTANT DEVELOPMENT RULES

1. Inspect the attached UI before coding.
2. Preserve the existing design language.
3. Do not rewrite working code unnecessarily.
4. Do not add technologies that are not required.
5. Keep the architecture modular.
6. Use Supabase Auth for passwords.
7. Never store raw passwords.
8. Keep secret API keys out of React Native.
9. Use clear loading/error/empty states.
10. Make Phase 1 fully runnable before moving to Phase 2.
11. Keep future ML/AI integration points clean.
12. Use mock data only where future functionality has intentionally been deferred.
13. Do not pretend mock AI responses are real AI.
14. Do not implement future features just because they are described in the product roadmap.
15. When I ask for a change, modify only the relevant part unless the change requires broader architectural work.

The immediate success criterion is:

```text
New Farmer
→ Register
→ Login
→ Draw Land
→ See Area
→ Save Land
→ Reach Home
→ Open AI Avatar UI
```

First inspect the attached ZIP and report your understanding. Do not start implementing until the project structure and existing UI are understood.
