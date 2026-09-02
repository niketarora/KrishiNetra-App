-- KrishiNetra 2.0 — Seed MSP for all reference crops (barley, gram, mustard)
--
-- Published Government of India MSP in rupees per quintal, as announced by the
-- Cabinet Committee on Economic Affairs (CCEA) on the recommendation of the
-- Commission for Agricultural Costs and Prices (CACP) for Rabi Marketing Seasons.
--
-- Idempotent: ends in `on conflict (crop_id, marketing_year, season) do nothing`.
-- ---------------------------------------------------------------------------

-- Barley (जौ)
insert into public.msp (crop_id, season, marketing_year, price_per_quintal, effective_from, source)
select c.id, v.season, v.marketing_year, v.price, v.effective_from, v.source
from public.crops c
join (values
  ('rabi', '2021-22', 1600.00, date '2021-04-01', 'Government of India MSP, RMS 2021-22 (CACP/CCEA)'),
  ('rabi', '2022-23', 1635.00, date '2022-04-01', 'Government of India MSP, RMS 2022-23 (CACP/CCEA)'),
  ('rabi', '2023-24', 1735.00, date '2023-04-01', 'Government of India MSP, RMS 2023-24 (CACP/CCEA)'),
  ('rabi', '2024-25', 1850.00, date '2024-04-01', 'Government of India MSP, RMS 2024-25 (CACP/CCEA)'),
  ('rabi', '2025-26', 1980.00, date '2025-04-01', 'Government of India MSP, RMS 2025-26 (CACP/CCEA)')
) as v (season, marketing_year, price, effective_from, source) on true
where c.code = 'barley'
on conflict (crop_id, marketing_year, season) do nothing;

-- Gram / Chana (चना)
insert into public.msp (crop_id, season, marketing_year, price_per_quintal, effective_from, source)
select c.id, v.season, v.marketing_year, v.price, v.effective_from, v.source
from public.crops c
join (values
  ('rabi', '2021-22', 5100.00, date '2021-04-01', 'Government of India MSP, RMS 2021-22 (CACP/CCEA)'),
  ('rabi', '2022-23', 5230.00, date '2022-04-01', 'Government of India MSP, RMS 2022-23 (CACP/CCEA)'),
  ('rabi', '2023-24', 5335.00, date '2023-04-01', 'Government of India MSP, RMS 2023-24 (CACP/CCEA)'),
  ('rabi', '2024-25', 5440.00, date '2024-04-01', 'Government of India MSP, RMS 2024-25 (CACP/CCEA)'),
  ('rabi', '2025-26', 5650.00, date '2025-04-01', 'Government of India MSP, RMS 2025-26 (CACP/CCEA)')
) as v (season, marketing_year, price, effective_from, source) on true
where c.code = 'gram'
on conflict (crop_id, marketing_year, season) do nothing;

-- Mustard / Rapeseed & Mustard (सरसों)
insert into public.msp (crop_id, season, marketing_year, price_per_quintal, effective_from, source)
select c.id, v.season, v.marketing_year, v.price, v.effective_from, v.source
from public.crops c
join (values
  ('rabi', '2021-22', 4650.00, date '2021-04-01', 'Government of India MSP, RMS 2021-22 (CACP/CCEA)'),
  ('rabi', '2022-23', 5050.00, date '2022-04-01', 'Government of India MSP, RMS 2022-23 (CACP/CCEA)'),
  ('rabi', '2023-24', 5450.00, date '2023-04-01', 'Government of India MSP, RMS 2023-24 (CACP/CCEA)'),
  ('rabi', '2024-25', 5650.00, date '2024-04-01', 'Government of India MSP, RMS 2024-25 (CACP/CCEA)'),
  ('rabi', '2025-26', 5950.00, date '2025-04-01', 'Government of India MSP, RMS 2025-26 (CACP/CCEA)')
) as v (season, marketing_year, price, effective_from, source) on true
where c.code = 'mustard'
on conflict (crop_id, marketing_year, season) do nothing;
