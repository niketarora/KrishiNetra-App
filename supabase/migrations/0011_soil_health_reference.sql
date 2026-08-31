-- KrishiNetra 2.0 — Soil Health Reference & Weather Wind Speed
--
-- Adds:
-- 1. wind_speed_kmh to public.weather table.
-- 2. photo_url to public.farms for field photo registration.
-- 3. public.soil_health_reference table populated with ICAR / Soil Health Card benchmarks.

-- 1. Add wind_speed_kmh to weather table
alter table public.weather
  add column if not exists wind_speed_kmh numeric(6, 2) check (wind_speed_kmh >= 0);

comment on column public.weather.wind_speed_kmh is
  'Maximum wind speed in km/h from Open-Meteo ERA5 / live observation.';

-- 2. Add photo_url to farms table
alter table public.farms
  add column if not exists photo_url text;

comment on column public.farms.photo_url is
  'Optional farmer-uploaded photo of the field/crop for optical vegetation analysis.';

-- 3. Create soil_health_reference table
create table if not exists public.soil_health_reference (
  id                  uuid primary key default gen_random_uuid(),
  state               text not null,
  district            text not null,
  soil_type           text,
  soil_ph_mean        numeric(4, 2) not null check (soil_ph_mean between 0 and 14),
  organic_matter_pct  numeric(4, 2) not null check (organic_matter_pct between 0 and 100),
  nitrogen_kg_ha      numeric(6, 2),
  phosphorus_kg_ha    numeric(6, 2),
  potassium_kg_ha      numeric(6, 2),
  source              text not null default 'ICAR / Soil Health Card Portal',
  created_at          timestamptz not null default now(),

  constraint soil_health_district_state_unique unique (state, district)
);

create index if not exists soil_health_state_district_idx
  on public.soil_health_reference (state, district);

comment on table public.soil_health_reference is
  'ICAR and Government of India Soil Health Card (SHC) district benchmark data.';

-- 4. Enable Row Level Security
alter table public.soil_health_reference enable row level security;

drop policy if exists "Signed-in farmers read soil health reference" on public.soil_health_reference;
create policy "Signed-in farmers read soil health reference"
  on public.soil_health_reference for select to authenticated using (true);

-- 5. Seed reference data for major agricultural districts across India
insert into public.soil_health_reference (state, district, soil_type, soil_ph_mean, organic_matter_pct, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha)
values
  -- Rajasthan
  ('Rajasthan', 'Jaipur', 'Sandy Loam', 7.80, 0.45, 165.0, 18.5, 210.0),
  ('Rajasthan', 'Pratapgarh', 'Black Clay Loam', 7.10, 0.58, 190.0, 22.0, 240.0),
  ('Rajasthan', 'Kota', 'Medium Black Soil', 7.40, 0.65, 210.0, 24.5, 260.0),
  ('Rajasthan', 'Jodhpur', 'Desert Sandy', 8.10, 0.30, 130.0, 14.0, 180.0),
  ('Rajasthan', 'Sri Ganganagar', 'Alluvial Clay', 8.00, 0.40, 175.0, 20.0, 230.0),
  ('Rajasthan', 'Alwar', 'Sandy Loam', 7.60, 0.50, 180.0, 19.0, 215.0),
  ('Rajasthan', 'Bharatpur', 'Alluvial Sandy Loam', 7.90, 0.42, 170.0, 17.5, 205.0),
  ('Rajasthan', 'Udaipur', 'Red and Yellow Soil', 6.90, 0.62, 195.0, 21.0, 250.0),

  -- Maharashtra
  ('Maharashtra', 'Pune', 'Medium Black Soil', 6.80, 0.85, 240.0, 28.0, 290.0),
  ('Maharashtra', 'Nashik', 'Black Clay Loam', 7.00, 0.78, 230.0, 26.5, 280.0),
  ('Maharashtra', 'Aurangabad', 'Deep Black Soil', 7.60, 0.60, 200.0, 22.0, 250.0),
  ('Maharashtra', 'Solapur', 'Shallow Black Soil', 7.90, 0.52, 180.0, 19.5, 230.0),
  ('Maharashtra', 'Sangli', 'Black Loamy Soil', 7.20, 0.70, 220.0, 25.0, 270.0),
  ('Maharashtra', 'Nagpur', 'Deep Black Cotton Soil', 6.90, 0.80, 235.0, 27.0, 285.0),
  ('Maharashtra', 'Kolhapur', 'Laterite and Black Soil', 6.40, 1.10, 275.0, 32.0, 320.0),

  -- Punjab
  ('Punjab', 'Ludhiana', 'Alluvial Loam', 7.40, 0.60, 225.0, 25.0, 265.0),
  ('Punjab', 'Amritsar', 'Alluvial Sandy Loam', 7.60, 0.55, 215.0, 23.5, 255.0),
  ('Punjab', 'Patiala', 'Alluvial Loam', 7.50, 0.58, 220.0, 24.0, 260.0),
  ('Punjab', 'Jalandhar', 'Alluvial Silty Loam', 7.30, 0.62, 230.0, 26.0, 270.0),
  ('Punjab', 'Bhatinda', 'Desert Alluvial', 8.20, 0.38, 160.0, 16.0, 200.0),

  -- Haryana
  ('Haryana', 'Karnal', 'Alluvial Loam', 7.50, 0.65, 230.0, 26.0, 275.0),
  ('Haryana', 'Hisar', 'Sandy Alluvial', 8.00, 0.45, 175.0, 18.0, 215.0),
  ('Haryana', 'Ambala', 'Loamy Alluvial', 7.20, 0.70, 240.0, 28.0, 285.0),
  ('Haryana', 'Kurukshetra', 'Silty Clay Loam', 7.40, 0.60, 225.0, 25.0, 270.0),

  -- Uttar Pradesh
  ('Uttar Pradesh', 'Varanasi', 'Alluvial Sandy Loam', 7.30, 0.62, 210.0, 22.0, 245.0),
  ('Uttar Pradesh', 'Lucknow', 'Gangetic Alluvium', 7.50, 0.55, 195.0, 20.5, 235.0),
  ('Uttar Pradesh', 'Meerut', 'Alluvial Loam', 7.40, 0.65, 220.0, 24.0, 260.0),
  ('Uttar Pradesh', 'Agra', 'Sandy Alluvium', 7.90, 0.45, 170.0, 17.5, 210.0),
  ('Uttar Pradesh', 'Prayagraj', 'Alluvial Loam', 7.60, 0.50, 185.0, 19.0, 225.0),

  -- Madhya Pradesh
  ('Madhya Pradesh', 'Indore', 'Medium Black Soil', 7.20, 0.75, 230.0, 26.0, 280.0),
  ('Madhya Pradesh', 'Ujjain', 'Deep Black Soil', 7.40, 0.68, 215.0, 24.0, 265.0),
  ('Madhya Pradesh', 'Bhopal', 'Black Clay Soil', 7.00, 0.80, 240.0, 27.5, 290.0),
  ('Madhya Pradesh', 'Jabalpur', 'Clayey Alluvium', 6.80, 0.85, 250.0, 29.0, 300.0),

  -- Gujarat
  ('Gujarat', 'Ahmedabad', 'Sandy Loam / Black Soil', 7.80, 0.48, 180.0, 19.0, 220.0),
  ('Gujarat', 'Surat', 'Deep Black Coastal Soil', 6.90, 0.85, 255.0, 30.0, 310.0),
  ('Gujarat', 'Rajkot', 'Medium Black Soil', 7.60, 0.52, 190.0, 21.0, 240.0),
  ('Gujarat', 'Vadodara', 'Black and Alluvial Soil', 7.20, 0.70, 225.0, 25.0, 275.0),

  -- Karnataka
  ('Karnataka', 'Bengaluru Rural', 'Red Sandy Loam', 6.20, 0.90, 260.0, 30.0, 310.0),
  ('Karnataka', 'Belagavi', 'Medium Black Soil', 6.80, 0.80, 235.0, 27.0, 285.0),
  ('Karnataka', 'Mysuru', 'Red Loamy Soil', 6.50, 0.88, 250.0, 29.0, 300.0),
  ('Karnataka', 'Dharwad', 'Black Cotton Soil', 7.10, 0.75, 225.0, 25.5, 275.0),

  -- Andhra Pradesh & Telangana
  ('Andhra Pradesh', 'Guntur', 'Black Clay Soil', 7.50, 0.58, 210.0, 23.0, 255.0),
  ('Andhra Pradesh', 'Krishna', 'Alluvial Delta Soil', 7.30, 0.65, 225.0, 25.0, 270.0),
  ('Telangana', 'Warangal', 'Red Earth and Black Soil', 6.90, 0.72, 230.0, 26.0, 280.0),

  -- Tamil Nadu
  ('Tamil Nadu', 'Thanjavur', 'Deltaic Alluvium', 6.60, 0.85, 245.0, 28.0, 295.0),
  ('Tamil Nadu', 'Coimbatore', 'Red and Black Soil', 7.20, 0.65, 215.0, 24.0, 260.0),

  -- Bihar & West Bengal
  ('Bihar', 'Patna', 'Gangetic Alluvial Loam', 7.20, 0.68, 220.0, 24.5, 265.0),
  ('West Bengal', 'Burdwan', 'Alluvial Clay Loam', 6.10, 1.05, 270.0, 31.0, 315.0)
on conflict (state, district) do update set
  soil_type = excluded.soil_type,
  soil_ph_mean = excluded.soil_ph_mean,
  organic_matter_pct = excluded.organic_matter_pct,
  nitrogen_kg_ha = excluded.nitrogen_kg_ha,
  phosphorus_kg_ha = excluded.phosphorus_kg_ha,
  potassium_kg_ha = excluded.potassium_kg_ha;
