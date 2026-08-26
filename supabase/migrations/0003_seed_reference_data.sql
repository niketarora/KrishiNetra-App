-- KrishiNetra 2.0 — Phase 2 reference data
--
-- Idempotent: every insert ends in `on conflict ... do nothing`, so re-running
-- this file is safe.
--
-- Seeded here:   crops, mandis, msp
-- NOT seeded:    market_prices, weather  (Phase 3 fills these from real feeds)
--                farm_crops              (farmer data is never seeded)
--
-- Provenance rule (docs/PHASE2_IMPLEMENTATION.md §4.3): every row states where
-- its value came from, and a value that cannot be verified is left null rather
-- than guessed. IMPLEMENTATION.md rule 13: never present mock data as real.

-- ---------------------------------------------------------------------------
-- crops
--
-- Wheat is the only crop Phase 2 needs end to end: it is the crop ML Model 1
-- predicts (docs/ML1_IMPLEMENTATION.md) and the only one with seeded MSP below.
-- The other three are the remaining major Rajasthan rabi/kharif crops, present
-- so the catalogue is usable; they carry no MSP row until those figures are
-- entered from the same source.
-- ---------------------------------------------------------------------------
insert into public.crops (code, name_en, name_hi, category, default_unit) values
  ('wheat',   'Wheat',   'गेहूँ',  'cereal', 'quintal'),
  ('mustard', 'Mustard', 'सरसों',  'oilseed', 'quintal'),
  ('barley',  'Barley',  'जौ',     'cereal', 'quintal'),
  ('gram',    'Gram',    'चना',    'pulse',  'quintal')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- mandis
--
-- Real Rajasthan APMC market yards. Each is the Krishi Upaj Mandi Samiti of its
-- district headquarters, cross-checked against the distinct mandi/district
-- pairs in ml/datasets/krishinetra_mandi_rajasthan.csv. That dataset is
-- synthetic (ML1_IMPLEMENTATION.md §3), so its names were verified against the
-- real APMC list rather than trusted on their own.
--
-- latitude/longitude are left null: no verified coordinate source was used, and
-- a guessed coordinate would be exactly the fabricated data rule 13 forbids.
-- Phase 4 distance matching backfills them.
-- ---------------------------------------------------------------------------
insert into public.mandis (code, name, district, state, source) values
  ('RJ-ALWAR',      'Alwar',          'Alwar',          'Rajasthan', 'Rajasthan APMC mandi directory'),
  ('RJ-BHARATPUR',  'Bharatpur',      'Bharatpur',      'Rajasthan', 'Rajasthan APMC mandi directory'),
  ('RJ-BUNDI',      'Bundi',          'Bundi',          'Rajasthan', 'Rajasthan APMC mandi directory'),
  ('RJ-HANUMANGARH','Hanumangarh',    'Hanumangarh',    'Rajasthan', 'Rajasthan APMC mandi directory'),
  ('RJ-JAIPUR',     'Jaipur',         'Jaipur',         'Rajasthan', 'Rajasthan APMC mandi directory'),
  ('RJ-KOTA',       'Kota',           'Kota',           'Rajasthan', 'Rajasthan APMC mandi directory'),
  ('RJ-SIKAR',      'Sikar',          'Sikar',          'Rajasthan', 'Rajasthan APMC mandi directory'),
  ('RJ-SGNR',       'Sri Ganganagar', 'Sri Ganganagar', 'Rajasthan', 'Rajasthan APMC mandi directory')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- msp — wheat, Rabi Marketing Season
--
-- Published Government of India MSP for wheat, in rupees per quintal, as
-- announced by the Cabinet Committee on Economic Affairs on the recommendation
-- of the Commission for Agricultural Costs and Prices (CACP).
--
-- effective_from is the start of each Rabi Marketing Season (1 April).
-- ---------------------------------------------------------------------------
insert into public.msp (crop_id, season, marketing_year, price_per_quintal, effective_from, source)
select c.id, v.season, v.marketing_year, v.price, v.effective_from, v.source
from public.crops c
join (values
  ('rabi', '2021-22', 1975.00, date '2021-04-01', 'Government of India MSP, RMS 2021-22 (CACP/CCEA)'),
  ('rabi', '2022-23', 2015.00, date '2022-04-01', 'Government of India MSP, RMS 2022-23 (CACP/CCEA)'),
  ('rabi', '2023-24', 2125.00, date '2023-04-01', 'Government of India MSP, RMS 2023-24 (CACP/CCEA)'),
  ('rabi', '2024-25', 2275.00, date '2024-04-01', 'Government of India MSP, RMS 2024-25 (CACP/CCEA)'),
  ('rabi', '2025-26', 2425.00, date '2025-04-01', 'Government of India MSP, RMS 2025-26 (CACP/CCEA)')
) as v (season, marketing_year, price, effective_from, source) on true
where c.code = 'wheat'
on conflict (crop_id, marketing_year, season) do nothing;

-- ---------------------------------------------------------------------------
-- market_prices and weather are intentionally left empty.
--
-- Phase 3 ingests them from AGMARKNET and a real weather provider. Until then
-- the API reports plainly that the data source is not connected, and never
-- returns a number it invented.
-- ---------------------------------------------------------------------------
