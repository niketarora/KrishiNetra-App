# KrishiNetra 2.0 — Product Requirements Document (PRD)

## 1. Product Overview

**Product:** KrishiNetra 2.0  
**Problem Statement:** SIH 2026 — PS 26132, "Strengthening market linkages and price discovery for farmers"  
**Organization:** Government of Maharashtra / Maharashtra State Innovation Society

KrishiNetra 2.0 is an AI-powered agricultural market intelligence and market-linkage platform. It is designed to help farmers understand the value of their crops, decide when and where to sell, discover suitable buyers, and eventually manage the transaction journey.

The product should feel like a **personal digital farming assistant**, not a complicated analytics application.

---

## 2. Product Vision

A farmer should be able to answer:

> "I have this crop. What is it worth, when should I sell it, where should I sell it, which buyer is best, and what will I actually earn?"

KrishiNetra should eventually provide this entire journey through a simple mobile experience and a multilingual AI Farmer Avatar.

---

## 3. Target User

### Primary User

Small and medium farmers who need:

- Easy access to market prices.
- Simple agricultural information.
- Better price discovery.
- Selling recommendations.
- Buyer discovery.
- Low-friction interaction through voice.

### Secondary Users

Future versions may support:

- FPOs.
- Cooperatives.
- Verified buyers.
- Processors.
- Institutional buyers.

---

## 4. Problem

Farmers often have limited visibility into:

- Current and expected prices.
- Nearby mandi prices.
- Market arrivals.
- Demand.
- Quality requirements.
- Buyer reliability.
- Transport costs.
- Storage options.
- Actual net realization.

Information is fragmented across different sources, which can lead to poor selling decisions and weak bargaining power.

---

## 5. Product Goals

### Primary Goals

1. Improve price discovery.
2. Reduce market information asymmetry.
3. Provide localized market intelligence.
4. Provide understandable selling recommendations.
5. Eventually connect farmers with verified buyers.
6. Help farmers compare net realization rather than only headline prices.
7. Create transparent transaction records.
8. Provide a simple multilingual AI interface.

### Non-Goals for Phase 1

Phase 1 is **not** intended to implement:

- Live marketplace transactions.
- Buyer matching.
- Payment processing.
- Logistics coordination.
- ML model development.
- Live AI voice processing.
- Full AI-agent backend.
- Real-time avatar intelligence.

These are later phases.

---

# 6. Product Scope

## Full Product Scope

```text
Authentication
→ Farm Mapping
→ Crop Data
→ Market Prices
→ Weather
→ Market Intelligence
→ Price Prediction
→ Selling Recommendation
→ Buyer Discovery
→ Buyer Matching
→ Crop Lot
→ Offers
→ Logistics / Storage
→ Transaction
→ Payment
→ AI Farmer Avatar
```

## Phase 1 Scope

Phase 1 focuses on the **working mobile foundation and UI**:

```text
Login / Register
→ Save credentials through Supabase Auth
→ Farmer onboarding
→ Farm mapping / drawing
→ Save farm boundary
→ Calculate area
→ Confirm farm
→ Navigate to Home
```

The **complete AI Farmer Avatar UI** should also be designed and implemented in Phase 1, but its actual AI/voice intelligence is intentionally deferred to a later phase.

---

# 7. User Journey

## First-Time User

```text
Open App
   ↓
Login / Register
   ↓
Email + Password
   ↓
Farmer Profile / Basic Onboarding
   ↓
Farm Mapping
   ↓
Draw Land Boundary
   ↓
Calculate Area
   ↓
Confirm Farm
   ↓
Home
```

## Future User Journey

```text
Home
 ↓
Farm / Crop
 ↓
Market Intelligence
 ↓
Selling Recommendation
 ↓
Buyer Matching
 ↓
Lot
 ↓
Offer
 ↓
Transaction
```

---

# 8. Functional Requirements

## Authentication

- Email registration.
- Email/password login.
- Password stored securely through Supabase Authentication.
- Session persistence.
- Logout.
- Basic authentication error handling.
- Protected app routes/screens.

Do not store raw passwords in application tables.

---

## Farm Mapping

The farmer should be able to:

- Open a map.
- Draw a polygon around their land.
- Add/remove polygon points.
- Edit the boundary.
- Calculate area.
- See area in acres/hectares.
- Confirm the boundary.
- Save the farm to Supabase.
- Return to Home after confirmation.

The saved farm should be associated with the authenticated farmer.

---

## Home

Phase 1 Home should be a functional foundation rather than a fully populated intelligence dashboard.

It should establish the final design language and contain appropriate placeholders/empty states for future:

- Farm information.
- Crop information.
- Market information.
- Recommendations.
- Notifications.
- AI assistant access.

---

## AI Farmer Avatar UI

Phase 1 should implement the **complete visual interaction UI**, without requiring the final AI backend.

The UI should include:

- Avatar presentation.
- Opening/closing interaction.
- Listening state.
- Thinking state.
- Speaking state.
- Microphone control.
- Conversation area.
- Voice activity indication.
- Error state.
- Loading state.
- Language selection/display where appropriate.

The avatar should appear as a major conversational experience rather than a standard text chatbot.

Actual STT, TTS, LLM, tool calling, and real-time avatar intelligence belong to a later phase.

---

# 9. Non-Functional Requirements

- Mobile-first.
- React Native.
- Android-first development.
- Clean and readable UI.
- Suitable for mid-range Android devices.
- Minimal unnecessary animations.
- Good loading/error states.
- Secure Supabase authentication.
- No secret API keys in the mobile application.
- Modular architecture.
- Backend abstraction for future ML/API integrations.

---

# 10. Design Principles

The application should feel:

- Agricultural.
- Trustworthy.
- Simple.
- Modern.
- Friendly.
- Accessible to non-technical users.

Avoid making the application look like an enterprise analytics dashboard.

Prioritize:

- Large readable text.
- Clear cards.
- Strong hierarchy.
- Simple actions.
- Map-focused interactions.
- Familiar icons.
- Clear status indicators.
- Minimal cognitive load.

---

# 11. Full Product Data Architecture

### Farmer-generated data

```text
Farmer
Farm
Crop
Yield
Quality
Lot
Offers
Transactions
```

### External data

```text
Mandi Prices
MSP
Market Arrivals
Weather
Production
Supply
Demand
Storage
Maps / Routing
```

### KrishiNetra-generated intelligence

```text
Price Predictions
Market Score
Selling Recommendation
Buyer Match Score
Net Realization
Risk Score
```

---

# 12. Future ML Components

ML models are developed separately from the mobile application and later integrated.

### Model 1 — Price Prediction

Predicts 1/3/7-day crop/mandi prices.

### Model 2 — Selling Recommendation

Eventually predicts:

- Sell Now
- Wait
- Sell Partially

Initially this can be implemented as a scoring engine.

### Model 3 — Buyer Matching

Ranks suitable buyers.

Initially this can be implemented as weighted ranking.

---

# 13. Future AI Layer

Future architecture:

```text
Farmer Voice
→ Speech-to-Text
→ AI Agent
→ KrishiNetra APIs / ML
→ Database / External APIs
→ Response
→ Text-to-Speech
→ Farmer Avatar
```

The AI must never invent live application-specific data.

---

# 14. Success Criteria

Phase 1 is successful when a new farmer can:

1. Open the app.
2. Register with email/password.
3. Log in.
4. Reach the protected application.
5. Open the farm mapping screen.
6. Draw their land.
7. See calculated area.
8. Save the farm.
9. Reach the Home screen.
10. Open and interact with the AI Avatar UI mock/interaction states.

