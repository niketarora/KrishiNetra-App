# KrishiNetra 2.0 — Single Source of Truth

> **Document Type:** Project Architecture, Features & Tech Stack Verification  
> **Status:** Codebase-Verified Analysis (Frontend, Backend, Database, ML, Configs)  
> **Version:** 2.0  

---

## 1. KRISHINETRA 2.0 — FEATURES

### Concise Feature Index

- **Farmer Authentication & Onboarding** — Authenticates farmers via mobile phone number with local OTP verification and profile creation.
- **Land Boundary Mapping** — Allows farmers to outline farm boundaries by walking the perimeter with GPS or drawing on Mapbox satellite imagery.
- **Multi-Land Management** — Enables farmers to register, inspect, switch between, and manage multiple agricultural land parcels.
- **Crop Registration & Agronomy Tracking** — Records sown crop varieties, sowing dates, and growth stages linked to land parcels.
- **Soil Moisture & Health Monitoring** — Estimates 10-meter surface soil moisture and SAR backscatter characteristics using satellite data and the OASSM-10 model.
- **Smart Irrigation Scheduling** — Recommends whether to irrigate or postpone based on real-time soil moisture and precipitation forecasts.
- **APMC Mandi Prices & MSP Tracking** — Displays government Minimum Support Prices (MSP) and APMC mandi commodity rates.
- **Crop Price Intelligence & 7-Day Forecasting** — Predicts 3-day and 7-day price trajectories and fair harvest valuation using historical mandi records.
- **Sell vs. Wait Decision Advisory** — Advises farmers whether to sell immediately or store harvest based on projected price gains versus holding costs.
- **Direct Buyer Discovery & Matching** — Ranks potential institutional and private buyers with net price realization and distance calculations.
- **Weather Intelligence & Forecast** — Delivers hyperlocal weather, temperature, humidity, rainfall, and wind conditions.
- **Multilingual Voice AI Avatar** — Provides hands-free voice conversations in Hindi and English powered by Indian-language speech AI and LLM reasoning.
- **Voice-Guided In-App Navigation** — Navigates the farmer through app screens and highlights interactive buttons via spoken requests.
- **Multimodal Live Camera Assistant** — Streams live camera frames and audio to Google Gemini Live for real-time field Q&A and diagnostics.
- **Crop Pathology Vision Diagnosis** — Analyzes leaf and crop photos via vision AI to assess plant health and identify visible disease symptoms.
- **AR Field Moisture Guidance** — Overlays directional arrows on a live camera feed using compass heading and GPS to guide farmers to field moisture spots.
- **Krishi Updates Feed** — Delivers location-filtered agricultural news and official NDMA disaster/hazard alerts.
- **Government Schemes Directory** — Catalogs central and state agricultural welfare schemes filterable by state and registered crop.
- **Krishi Academy** — Provides local agricultural guides, crop-specific recommendations, and interactive flashcards.
- **Interactive Onboarding Tour** — Guides first-time farmers through dashboard features using spotlight UI highlights.
- **Farmer Profile & Language Settings** — Manages farmer personal details, state/district locations, and English/Hindi language toggles.
- **Smart Farm Calendar** — Displays a monthly farming schedule with dates for irrigation, fertilization, and harvesting.
- **Krishi Memory (Farm Diary)** — Tracks chronological milestones of land registration and historical crop plantings.
- **Farmer Communication Alerts** — Displays an in-app log of emergency alerts, weather warnings, and advisories.
- **AR Learning Preview** — Demonstrates educational field procedures through a simulated augmented-reality viewfinder.

---

### Implementation Status Breakdown

#### ✅ Working
*Features backed by live backend endpoints, verified database tables, hardware sensors, or production AI/ML APIs:*

- **Farmer Authentication & Onboarding** — Real phone-to-Supabase authentication bridge and session tokens.
- **Land Boundary Mapping** — Functional Mapbox satellite drawing, live GPS perimeter walk, and Turf.js polygon calculations.
- **Multi-Land Management** — Full multi-farm CRUD operations stored in Supabase with boundary visualizations.
- **Crop Registration & Agronomy Tracking** — Farm-crop relational schema and sowing timeline calculations.
- **Soil Moisture & Health Monitoring** — OASSM-10 multi-sensor inference engine with deterministic physical fallback.
- **Smart Irrigation Scheduling** — Dynamic irrigation advisory rules combining soil moisture and weather metrics.
- **APMC Mandi Prices & MSP Tracking** — Supabase reference tables with data.gov.in AGMARKNET ingestion scripts.
- **Crop Price Intelligence & 7-Day Forecasting** — Backed by 1.11M cleaned mandi records in SQLite and CatBoost-based trend projection logic.
- **Sell vs. Wait Decision Advisory** — Computes holding viability factoring storage and transport costs.
- **Weather Intelligence & Forecast** — Open-Meteo grid-cell and district-level weather data retrieval.
- **Multilingual Voice AI Avatar** — End-to-end Sarvam AI (STT/TTS), Google Gemini, and mobile audio streaming.
- **Voice-Guided In-App Navigation** — Intent router mapped to an in-app target registry with spotlight highlights.
- **Multimodal Live Camera Assistant** — Native WebSocket client connecting live camera frames to Gemini Live API with tool calls.
- **Crop Pathology Vision Diagnosis** — Gemini Vision multimodal endpoint with structured pathology schema output.
- **AR Field Moisture Guidance** — Live camera viewport with device compass and GPS bearing calculations to target coordinates.
- **Krishi Updates Feed** — Live integration with NDMA SACHET CAP RSS feeds, GDELT API, and Google News RSS.
- **Government Schemes Directory** — Searchable Supabase database of central and state schemes with eligibility details.
- **Interactive Onboarding Tour** — Spotlight tour overlay guiding new users across the UI.
- **Farmer Profile & Language Settings** — Profile persistence in Supabase with full English and Hindi localization.

#### ⚠️ Partially Working
*Features with operational UI and logic but reliant on synthetic prototype data or fallback modes:*

- **Direct Buyer Discovery & Matching** — Match score and net realization logic is fully implemented, but operates on synthetic prototype CSV datasets rather than live buyer platform APIs.
- **Krishi Academy** — Fully functional UI and progress tracking, but content is loaded from static local files rather than a remote CMS.
- **Expert Agronomy & Deep Research Avatar Modes** — Backend orchestrator routes requests to Lyzr Agent Studio and Tavily Search, but gracefully falls back to Gemini when third-party keys are unconfigured.

#### 🟡 Mock / Demo
*Purely simulated presentations or UI mockups using sample data:*

- **Smart Farm Calendar** — Real month calendar UI, but populated with simulated demo events gated behind demo mode.
- **Krishi Memory (Farm Diary)** — Farm registration and crop metadata are real, but detailed field activity logs use mock data.
- **Farmer Communication Alerts** — Displays alert history using a local in-memory provider with no real SMS or voice call delivery.
- **AR Learning Preview** — Static viewfinder UI mock demonstrating step-by-step guidance without real computer vision or camera integration.

#### 🔵 Planned / Not Implemented
*Features documented in roadmap or architectural designs that have no active runtime implementation:*

- **Digital Marketplace Transactions & Escrow** — Phase 4 routes (`/buyers`, `/lots`, `/offers`) are intentionally not mounted in the backend.
- **Automated SMS & Telephony Broadcasts** — External communication engines (e.g., Exotel, Twilio) are not integrated.
- **Automated Satellite Earth-Observation Pipeline** — Google Earth Engine / Sentinel automated satellite ingestion cron jobs are stubbed in unmounted scaffolding.
- **Press Information Bureau (PIB) News Feed** — Provider exists in code but is inactive due to external HTTP 403 access blocks.
- **22-Language Voice Support** — Full 22-language avatar pipeline is scheduled for Phase 5; the app currently supports English and Hindi.

---

## 2. KRISHINETRA 2.0 — ACTUAL TECH STACK

| Technology | Where/How it is used |
|------------|----------------------|
| **React Native (0.86.2)** | Mobile application UI framework running React 19 |
| **Expo (SDK 57)** | Mobile runtime, application configuration, and native toolchain |
| **TypeScript** | Type-safe programming language across frontend, backend, and scripts |
| **React Navigation (v7)** | Mobile screen stacks, bottom tabs, and modal navigation |
| **Mapbox (`@rnmapbox/maps`)** | Satellite imagery mapping and interactive polygon boundary drawing |
| **Expo Location** | GPS device positioning for farm centroid and boundary walk tracing |
| **Expo Camera** | Live camera preview for AR moisture guidance and multimodal visual assistant |
| **Expo Audio** | Native voice recording and speech playback for avatar interactions |
| **React Native Reanimated** | UI animations, spotlight onboarding tours, and interactive widgets |
| **react-i18next / i18next** | Complete application localization in English and Hindi |
| **Node.js (>=20)** | Backend JavaScript runtime executing in ES Module format |
| **Express (v5.1)** | REST API server with routing, rate limiting, and middleware |
| **Zod** | Schema validation for API payloads, query strings, and environment variables |
| **Supabase (PostgreSQL)** | Primary database with Row Level Security (RLS) for farmers, farms, crops, weather, and schemes |
| **Supabase Auth** | JWT issuance and session management via MagicLink and custom phone auth bridge |
| **Supabase Storage** | Public object storage bucket (`krishi-academy`) for tutorial assets and media |
| **SQLite (`node:sqlite`)** | Local embedded backend database querying 1.11M cleaned historical mandi records (`preparation.sqlite`) |
| **Python (3.11+)** | Experimental ML inference service environment |
| **FastAPI** | Python microservice framework serving the OASSM-10 soil moisture prediction endpoint |
| **OASSM-10 Transformer Model** | Multi-sensor soil moisture algorithm combining Sentinel-1 SAR, optical, DEM, and weather parameters |
| **CatBoost (`.cbm`)** | Trained price forecasting models with Node.js historical ensemble calculation |
| **Turf.js (`@turf/*`)** | Geospatial calculations for field polygon area, bounding box, and centroid coordinates |
| **Google Gemini (`@google/genai`)** | Conversational avatar chat, intent routing, and crop pathology vision diagnostics (`gemini-3.6-flash`) |
| **Gemini Multimodal Live API** | Real-time WebSocket streaming of live camera frames and two-way voice (`gemini-3.1-flash-live-preview`) |
| **Sarvam AI APIs** | Speech-to-Text (`saarika:v2.5`) and Text-to-Speech (`bulbul:v3`) for Indian-language voice |
| **Lyzr Agent Studio** | Optional agentic backend service for agricultural agronomy advisory |
| **Tavily AI Search** | Optional deep web search service for agricultural literature and crop inquiries |
| **Open-Meteo API** | Weather data source for historical and forecast meteorological variables |
| **data.gov.in (AGMARKNET)** | Indian government open data API for daily APMC mandi commodity prices |
| **NDMA SACHET (CAP RSS)** | Disaster Management Authority feed for weather hazard and natural disaster alerts |
| **Google News RSS** | Fallback search aggregator for regional agricultural news updates |
| **Nominatim (OpenStreetMap)** | Reverse geocoding service translating GPS coordinates to village, district, and state |
| **Jest & Testing Library** | Unit and integration test suites for both mobile frontend and backend services |
| **Docker** | Containerization setup for deploying the Python ML inference service |
| **Expo Application Services (EAS)** | Cloud build and deployment configuration for Android release APK packaging |

---

### Unused / Conflict Resolutions

- **Mapbox vs. Google Maps:** Mapbox (`@rnmapbox/maps`) is **actually used** across all map views. Google Maps is not used (references in older docs are legacy artifacts).
- **React Native vs. Flutter:** React Native with Expo is **actually used**. Flutter is not used.
- **Supabase vs. Firebase:** Supabase is **actually used** for database, auth, and storage. Firebase is not present.
- **Node.js/Express vs. Python/FastAPI:** Node.js/Express is the **primary backend**. Python/FastAPI is a dedicated microservice strictly for OASSM-10 ML inference.
- **Telephony / SMS (Exotel / Twilio):** Mentioned in design specifications, but **not implemented**; authentication uses an in-memory dev OTP bridge and alerts use a local mock provider.
- **PIB RSS Feed:** Implemented in backend code, but **unused/inactive** due to external HTTP 403 access blocks.

---

## 3. OFFICIAL KRISHINETRA 2.0 STACK

- **Frontend:** React Native (0.86) with Expo (SDK 57), TypeScript, React Navigation, Reanimated, and react-i18next
- **Backend:** Node.js (>=20) with Express 5 (ESM), Zod validation, and a Python FastAPI ML microservice
- **Database:** Supabase (PostgreSQL with RLS) and local embedded SQLite (`preparation.sqlite`, 1.11M mandi records)
- **Authentication:** Supabase Auth (JWT + MagicLink phone identity bridge)
- **Storage:** Supabase Storage (`krishi-academy` bucket)
- **AI/ML:** OASSM-10 Multi-Sensor Soil Moisture Model, CatBoost models, Turf.js geospatial math, and Gemini Vision pathology
- **External APIs:** Google Gemini APIs, Sarvam AI (STT & TTS), Open-Meteo, data.gov.in (AGMARKNET), NDMA SACHET, Lyzr AI, and Tavily
- **Maps/GPS:** Mapbox (`@rnmapbox/maps`) with satellite layer and Expo Location
- **Communication:** Sarvam AI Voice TTS with native Expo Audio streaming (telephony SMS/calls not implemented)
- **Deployment:** Expo Application Services (EAS) for Android APK builds and Docker for Python ML services

---

## 4. ONE-LINE APP SUMMARY

KrishiNetra 2.0 is an AI-driven smart farming and market intelligence mobile application that provides Indian farmers with field boundary mapping, 10m satellite soil moisture analytics, APMC mandi price forecasting, and a multilingual multimodal voice-and-camera agricultural assistant.
