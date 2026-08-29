-- KrishiNetra 2.0 — Field-coordinate weather on a 0.25° ERA5 grid
--
-- Re-keys the weather table from (district, state) to (grid_lat, grid_lng).
-- Snapping farm centroids to a 0.25° grid (~750 km²):
--   1. Matches ERA5 / Open-Meteo's own spatial resolution (no false precision).
--   2. Preserves farmer privacy in a public reference table.
--
-- Legacy rows were re-derivable observations without farmer data, and cannot
-- be honestly mapped to coordinates from a district name. They are cleared here
-- and re-populated on demand or via npm run ingest:weather.

-- 1. Add grid coordinate columns
alter table public.weather
  add column if not exists grid_lat numeric(9, 6),
  add column if not exists grid_lng numeric(9, 6);

-- 2. Clear legacy district-only rows
delete from public.weather where grid_lat is null or grid_lng is null;

-- 3. Enforce not null on grid coordinates
alter table public.weather
  alter column grid_lat set not null,
  alter column grid_lng set not null;

-- 4. District and state become optional descriptive fields
alter table public.weather
  alter column district drop not null,
  alter column state drop not null;

-- 5. Drop old unique constraint and add grid-based unique constraint
alter table public.weather
  drop constraint if exists weather_unique_observation;

alter table public.weather
  add constraint weather_grid_observation_unique unique (grid_lat, grid_lng, observed_on);

-- 6. Index for fast coordinate + date lookups
drop index if exists weather_district_date_idx;
create index if not exists weather_grid_date_idx
  on public.weather (grid_lat, grid_lng, observed_on desc);

comment on column public.weather.grid_lat is
  'Latitude snapped to 0.25° grid centre (ERA5 resolution).';
comment on column public.weather.grid_lng is
  'Longitude snapped to 0.25° grid centre (ERA5 resolution).';
