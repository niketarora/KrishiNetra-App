# KrishiNetra 2.0 — Technical Requirements Document (TRD)

## 1. Document Purpose

This document defines the technical architecture, requirements, interfaces, data structures, security model, development phases, and integration standards for KrishiNetra 2.0.

KrishiNetra 2.0 is being developed for SIH 2026 Problem Statement 26132:

**"Strengthening market linkages and price discovery for farmers."**

The system will eventually combine a React Native mobile application, Node.js/Express backend, Supabase, external agricultural APIs, separately developed ML services, and a multilingual AI Farmer Avatar.

---

# 2. Technical Goals

The architecture must:

1. Support the complete KrishiNetra product roadmap.
2. Keep Phase 1 simple and independently deployable.
3. Allow ML models to be developed independently and integrated later.
4. Keep AI/voice/avatar services independent from the core application.
5. Protect user and authentication data.
6. Prevent external API secrets from being exposed in the mobile application.
7. Support future scaling without requiring a complete rewrite.
8. Maintain clear separation between frontend, backend, data, ML, and AI layers.

---

# 3. Technology Stack

## Mobile

- React Native
- TypeScript preferred for new implementation
- Android-first
- Map SDK/library compatible with React Native

## Backend

- Node.js
- Express.js
- JavaScript/TypeScript
- REST API architecture

## Database / Authentication

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security

## ML

Separate Python services:

- Python
- FastAPI
- XGBoost / LightGBM initially
- Pandas
- NumPy
- Scikit-learn

ML models are developed independently and integrated through documented APIs.

## AI

Later phase:

- LLM
- Function/tool calling
- Speech-to-Text
- Text-to-Speech
- Avatar provider/service

## Deployment

- React Native mobile build/distribution
- Node.js backend on Render or Vercel-compatible infrastructure
- ML service on Render or equivalent Python-compatible infrastructure
- Supabase hosted services

---

# 4. System Architecture

```text
                     React Native Mobile App
                              │
                              │ HTTPS / REST
                              ▼
                     Node.js + Express API
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
      Supabase            ML Services       External APIs
      PostgreSQL          Python/FastAPI      Market
      Auth                                    Weather
      Storage                                 Maps
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                              ▼
                         AI Agent Layer
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                   STT                 TTS
                    │                   │
                    └─────────┬─────────┘
                              ▼
                       Farmer Avatar
```

---

# 5. Architectural Principles

## 5.1 Separation of Responsibilities

### React Native

Responsible for:

- UI
- Navigation
- User interaction
- Local UI state
- Calling backend APIs
- Map interaction
- Authentication session handling

It should not contain business-critical agricultural logic.

### Node.js Backend

Responsible for:

- Business logic
- Authorization
- API aggregation
- External API integration
- Data validation
- Database operations
- ML service integration
- AI tool/API orchestration

### Supabase

Responsible for:

- Authentication
- Persistent relational data
- Storage
- Access control through RLS

### ML Services

Responsible only for:

- Model inference
- Prediction
- Recommendation/ranking inference

### AI Layer

Responsible for:

- Natural-language interaction
- Tool selection
- Conversational responses
- Voice orchestration

---

# 6. Development Phases

## Phase 1 — UI + Authentication + Farm Mapping + Avatar UI

### Scope

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

Plus:

```text
Complete AI Farmer Avatar UI
```

### Excluded

- Live market APIs
- ML models
- Buyer marketplace
- Transactions
- Logistics
- Real AI
- STT/TTS
- Real-time avatar intelligence

---

## Phase 2 — Backend + Agricultural Data Foundation

Implement:

- Node.js/Express
- Supabase integration
- Farmer APIs
- Farm APIs
- Crop APIs
- Market data schemas
- Weather schemas
- Authentication middleware
- RLS

---

## Phase 3 — ML Integration + Market Intelligence

Integrate externally developed:

1. Price Prediction
2. Selling Recommendation
3. Buyer Matching

Initially focus on market intelligence before marketplace transactions.

---

## Phase 4 — Market Linkage + Transactions

Implement:

- Buyers
- Buyer requirements
- Buyer matching
- Crop lots
- Offers
- Negotiation
- Logistics
- Storage
- Orders
- Payment status
- Transactions
- Grievances

---

## Phase 5 — AI Farmer Avatar Intelligence

Implement:

- LLM/AI Agent
- Tool calling
- Speech-to-Text
- Text-to-Speech
- 22-language support
- Real-time avatar interaction

---

# 7. Phase 1 Technical Requirements

## 7.1 Authentication

Use:

**Supabase Auth — Email + Password**

Required functionality:

```text
Register
Login
Logout
Session persistence
Protected navigation
Authentication error handling
```

Do not store passwords manually.

The authenticated Supabase user ID must be used as the ownership identifier.

---

# 8. Phase 1 Database

Keep the Phase 1 database minimal.

## `farms`

Suggested schema:

```text
id                 UUID / primary key
user_id            UUID / foreign key
boundary           JSONB / GeoJSON representation
area_sq_meters     numeric
area_acres         numeric
area_hectares      numeric
centroid_lat       numeric
centroid_lng       numeric
created_at         timestamp
updated_at         timestamp
```

### Security

RLS policy:

```text
A farmer can SELECT/INSERT/UPDATE/DELETE only farms
where farms.user_id = authenticated user's ID.
```

---

# 9. Farm Mapping Requirements

The React Native map must support:

- Map display
- Polygon drawing
- Point addition
- Point deletion/editing
- Polygon closure
- Area calculation
- Boundary preview
- Confirmation
- Save to Supabase

### Area Calculation

Prefer a reliable geospatial calculation method.

Store:

- Square meters
- Acres
- Hectares

The UI should display the unit most useful to the farmer.

---

# 10. Phase 1 Navigation

Suggested navigation:

```text
Auth Stack
├── Login
└── Register

Onboarding Stack
└── Farm Mapping

Main App
├── Home
├── Farm
├── Market
├── History
└── Profile
```

Future screens can initially be placeholders.

The AI Avatar should be an independent interaction layer, not a mandatory bottom-navigation item.

---

# 11. AI Avatar UI Technical Requirements — Phase 1

The Phase 1 implementation should provide a complete visual shell.

### States

```text
IDLE
LISTENING
THINKING
SPEAKING
ERROR
```

### UI Components

```text
AvatarContainer
AvatarVisual
ConversationPanel
MicrophoneButton
VoiceActivityIndicator
StateIndicator
CloseButton
LoadingIndicator
```

The state should be controlled through a clean state machine or equivalent React state architecture so that real AI functionality can be connected later without rebuilding the UI.

Example conceptual state:

```text
avatarState:
  idle
  listening
  thinking
  speaking
  error
```

---

# 12. Future Database Architecture

After Phase 1, expand to:

```text
profiles
farms
crops
mandis
market_prices
msp
market_arrivals
weather
buyers
buyer_requirements
crop_quality
storage
transport
lots
offers
orders
payments
transactions
grievances
notifications
```

---

# 13. Core Data Relationships

```text
User
 │
 ├── Farms
 │     │
 │     └── Crops
 │           │
 │           └── Lots
 │                 │
 │                 └── Offers
 │                       │
 │                       └── Orders
 │                             │
 │                             ├── Payments
 │                             └── Transactions
 │
 └── Notifications
```

Buyer relationships:

```text
Buyer
 │
 └── Buyer Requirements
       │
       └── Matching
              │
              └── Farmer Lots
```

---

# 14. Backend API Standards

All application-specific external access should go through the backend.

Suggested API prefixes:

```text
/api/v1/auth
/api/v1/farmers
/api/v1/farms
/api/v1/crops
/api/v1/mandis
/api/v1/market-prices
/api/v1/msp
/api/v1/weather
/api/v1/market-intelligence
/api/v1/predictions
/api/v1/recommendations
/api/v1/buyers
/api/v1/matching
/api/v1/lots
/api/v1/offers
/api/v1/logistics
/api/v1/storage
/api/v1/orders
/api/v1/payments
/api/v1/transactions
/api/v1/grievances
/api/v1/ai
```

---

# 15. API Response Standard

Use consistent responses.

### Success

```json
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request"
  }
}
```

Do not expose internal stack traces to clients.

---

# 16. ML Integration Architecture

ML services remain independent.

```text
Node.js Backend
      │
      │ HTTPS
      ▼
Python FastAPI ML Service
      │
      ▼
Model
```

The mobile application should never directly call the ML service.

---

# 17. Price Prediction API Contract

Final contract will be provided when the ML model is ready.

Conceptual request:

```json
{
  "crop": "wheat",
  "mandi": "example",
  "features": {
    "historical_prices": [],
    "arrivals": [],
    "weather": {},
    "msp": 0
  }
}
```

Conceptual response:

```json
{
  "predicted_price_1d": 0,
  "predicted_price_3d": 0,
  "predicted_price_7d": 0,
  "confidence": 0,
  "model_version": "v1"
}
```

Do not implement this exact contract until the ML service contract is finalized.

---

# 18. ML Model Requirements

## Model 1 — Price Prediction

Initial features:

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

Future features:

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
1-day prediction
3-day prediction
7-day prediction
confidence
```

---

## Model 2 — Selling Recommendation

Inputs:

```text
current_price
predicted_price
weather_risk
arrival_trend
demand
MSP
storage_cost
transport_cost
```

Outputs:

```text
recommendation
score
confidence
reason
```

---

## Model 3 — Buyer Matching

Inputs:

```text
crop
quantity
quality
buyer_price
distance
reliability
pickup
payment_history
logistics
```

Outputs:

```text
buyer_rank
match_score
```

---

# 19. External API Architecture

Potential external API categories:

```text
Mandi / AGMARKNET
MSP / Government Data
Weather
Maps / Geocoding
Routing / Distance
Storage / Warehouse
Verification
Speech-to-Text
Text-to-Speech
Avatar
```

External API credentials must be stored on the backend/server environment, never directly inside the React Native application.

---

# 20. AI Agent Architecture

Later:

```text
React Native
     │
     ▼
Speech-to-Text
     │
     ▼
AI Agent
     │
     ▼
Backend Tools
     │
 ┌───┼─────────────┐
 ▼   ▼             ▼
DB  ML Services  External APIs
     │
     ▼
AI Response
     │
     ▼
Text-to-Speech
     │
     ▼
Avatar
```

Possible backend tools:

```text
get_farmer_data
get_farm_data
get_crop_data
get_market_price
get_weather
get_price_prediction
get_selling_recommendation
find_buyers
get_offers
get_transaction_status
get_net_realisation
```

---

# 21. AI Safety / Data Integrity

The AI agent must not fabricate application-specific information.

For questions involving:

- Current prices
- Weather
- Buyer offers
- Predictions
- Payments
- Orders
- Transactions

the agent must retrieve the actual value from backend tools.

If the required data is unavailable, it should explicitly say that the data is unavailable rather than guessing.

---

# 22. Security Requirements

## Authentication

- Supabase Auth.
- Email/password.
- Session tokens.
- Secure session handling.

## Authorization

- Supabase RLS.
- Backend authorization.
- Ownership checks.

## Secrets

Never put:

```text
API keys
service role keys
ML service secrets
LLM keys
payment secrets
```

inside the React Native source.

Use environment variables and server-side configuration.

## Input Security

Validate:

- Email
- Password
- Coordinates
- Farm boundary
- Numeric values
- Crop data
- API payloads

---

# 23. Error Handling

Every major operation should have:

```text
Loading
Success
Empty
Error
Retry
```

Examples:

### Map Failure

Show:

> Unable to load map. Please try again.

### Supabase Failure

Show:

> We couldn't save your farm. Please try again.

### ML Failure

Show:

> Prediction is temporarily unavailable.

Never show a fake prediction when the ML service fails.

---

# 24. Performance Requirements

Phase 1:

- Fast initial screen rendering.
- Avoid unnecessary API calls.
- Avoid excessive map re-renders.
- Keep map interactions responsive.
- Use loading placeholders.
- Optimize images/assets.
- Avoid unnecessary global state.

Future:

- Cache appropriate market/weather data.
- Paginate buyer and transaction lists.
- Cache repeated API responses where appropriate.
- Optimize ML inference latency.

---

# 25. Testing Requirements

## React Native

Test:

- Registration.
- Login.
- Logout.
- Session restoration.
- Protected navigation.
- Map loading.
- Polygon drawing.
- Polygon editing.
- Area calculation.
- Farm saving.
- Home navigation.
- Avatar state transitions.

## Backend

Test:

- Authentication.
- Authorization.
- RLS.
- Farm CRUD.
- API validation.
- External API errors.

## ML

Test:

- Input schema.
- Model inference.
- Prediction accuracy.
- API availability.
- Invalid inputs.
- Model versioning.

## AI

Later test:

- Voice recognition.
- Language handling.
- Tool calling.
- Hallucination prevention.
- API failure handling.
- Avatar state synchronization.

---

# 26. Environment Configuration

Example:

```text
# React Native
SUPABASE_URL=
SUPABASE_ANON_KEY=
API_BASE_URL=

# Backend
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WEATHER_API_KEY=
MAPS_API_KEY=
ML_SERVICE_URL=
AI_API_KEY=
```

Only variables that are safe for client use may be included in the mobile application.

---

# 27. Git / Repository Strategy

Recommended:

```text
main
develop
feature/*
fix/*
```

Commit examples:

```text
feat: add email authentication
feat: add farm polygon mapping
feat: save farm to supabase
feat: add avatar UI states
fix: handle farm save error
```

Do not commit:

```text
.env
API secrets
service-role keys
private credentials
```

---

# 28. Phase 1 Definition of Done

Phase 1 is complete only when:

```text
[ ] React Native app runs
[ ] UI matches the provided design
[ ] Supabase connected
[ ] Registration works
[ ] Login works
[ ] Logout works
[ ] Session persistence works
[ ] Protected routes work
[ ] Map works
[ ] Farmer can draw land
[ ] Farmer can edit land
[ ] Area is calculated
[ ] Farm can be confirmed
[ ] Farm is saved in Supabase
[ ] Farmer reaches Home
[ ] AI Avatar UI opens
[ ] Avatar idle state works
[ ] Avatar listening state works
[ ] Avatar thinking state works
[ ] Avatar speaking state works
[ ] Avatar error state works
[ ] UI does not depend on real AI
[ ] No secret keys are exposed
```

---

# 29. Integration Principle

Each phase should be independently testable.

```text
Phase 1
UI + Auth + Farm
        ↓
Phase 2
Backend + Data
        ↓
Phase 3
ML + Intelligence
        ↓
Phase 4
Marketplace + Transactions
        ↓
Phase 5
AI + Voice + Avatar
```

Do not create tight dependencies between future components before they are needed.

---

# 30. Final Technical Architecture

```text
                     KRISHINETRA 2.0
                            │
              ┌─────────────┴─────────────┐
              │                           │
       React Native App             AI Farmer Avatar
              │                           │
              ▼                           │
       Node.js + Express ◄────────────────┘
              │
      ┌───────┼────────┬───────────────┐
      ▼       ▼        ▼               ▼
  Supabase   ML     Market APIs     Weather/Maps
      │       │
      │       ├── Price Prediction
      │       ├── Selling Recommendation
      │       └── Buyer Matching
      │
      └── Farmer / Farm / Crop / Buyer /
          Lot / Offer / Order / Payment /
          Transaction data
```

The system should remain modular so that individual services can be replaced without rewriting the entire application.
