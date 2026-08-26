-- KrishiNetra 2.0 — Phase 2 schema
--
-- Scope: the agricultural data foundation the intelligence layer will need
-- (docs/PHASE2_IMPLEMENTATION.md §3, TRD §12, IMPLEMENTATION.md Phase 2).
-- Buyers, buyer requirements, lots, offers, orders, payments and transactions
-- are Phase 4 and are deliberately absent.
--
-- Two ownership shapes live here:
--
--   farm_crops                     farmer-owned, one `for all` policy on user_id
--   crops, mandis, market_prices,  reference data, `for select` only. With RLS
--   msp, weather                   on and no write policy, only the service-role
--                                  key can write them. That is deliberate: a
--                                  farmer never writes reference data.
--
-- market_prices and weather ship EMPTY. Phase 3 fills them from real sources.
-- IMPLEMENTATION.md rule 13: never present mock data as real.

-- ---------------------------------------------------------------------------
-- crops — the crop catalogue
-- ---------------------------------------------------------------------------
create table if not exists public.crops (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name_en      text not null,
  -- Crop names are data, not UI copy, so the Hindi name belongs here rather
  -- than in mobile/src/i18n/locales/hi.json.
  name_hi      text,
  category     text,
  default_unit text not null default 'quintal',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.crops is
  'Crop catalogue. Reference data, written only by the service role.';

-- ---------------------------------------------------------------------------
-- farm_crops — what the farmer has planted on a field
-- ---------------------------------------------------------------------------
create table if not exists public.farm_crops (
  id                  uuid primary key default gen_random_uuid(),
  farm_id             uuid not null references public.farms (id) on delete cascade,
  -- Denormalised from farms so the RLS policy is a column comparison rather
  -- than a subquery. The API sets it from the JWT, never from the request body.
  user_id             uuid not null references auth.users (id) on delete cascade,
  crop_id             uuid not null references public.crops (id),
  variety             text,
  sown_on             date,
  expected_harvest_on date,
  -- The portion of the field under this crop. Not required to equal
  -- farms.area_acres: a farmer may split one field between crops.
  area_acres          numeric(12, 4) check (area_acres > 0),
  status              text not null default 'planned',
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint farm_crops_status_check check (
    status in ('planned', 'sown', 'growing', 'harvested')
  ),
  constraint farm_crops_harvest_after_sowing check (
    expected_harvest_on is null
    or sown_on is null
    or expected_harvest_on >= sown_on
  )
);

create index if not exists farm_crops_farm_id_idx on public.farm_crops (farm_id);
create index if not exists farm_crops_user_id_idx on public.farm_crops (user_id);

comment on table public.farm_crops is
  'A crop planted on a farmer-owned field. Farmer-owned row.';

-- ---------------------------------------------------------------------------
-- mandis — market yards
-- ---------------------------------------------------------------------------
create table if not exists public.mandis (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  district   text not null,
  state      text not null,
  -- Nullable on purpose: a null coordinate is honest, a guessed one is not.
  -- Phase 4 distance matching can backfill these from a verified source.
  latitude   numeric(9, 6) check (latitude between -90 and 90),
  longitude  numeric(9, 6) check (longitude between -180 and 180),
  source     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mandis_state_district_idx on public.mandis (state, district);

comment on table public.mandis is
  'APMC market yards. Reference data, written only by the service role.';

-- ---------------------------------------------------------------------------
-- market_prices — daily mandi price observations. EMPTY until Phase 3.
-- ---------------------------------------------------------------------------
create table if not exists public.market_prices (
  id              uuid primary key default gen_random_uuid(),
  mandi_id        uuid not null references public.mandis (id) on delete cascade,
  crop_id         uuid not null references public.crops (id),
  variety         text,
  grade           text,
  price_date      date not null,
  min_price       numeric(12, 2) check (min_price > 0),
  max_price       numeric(12, 2) check (max_price > 0),
  modal_price     numeric(12, 2) not null check (modal_price > 0),
  -- IMPLEMENTATION.md lists a separate market_arrivals table. Arrivals are
  -- folded in here instead: that is how they arrive in the AGMARKNET feed and
  -- in ml/datasets/krishinetra_mandi_rajasthan.csv, and a one-to-one side
  -- table would buy nothing but a join. Recorded in docs/PHASE2_NOTES.md.
  arrivals_tonnes numeric(12, 3) check (arrivals_tonnes >= 0),
  source          text not null,
  created_at      timestamptz not null default now(),

  constraint market_prices_price_ordering check (
    (min_price is null or min_price <= modal_price)
    and (max_price is null or modal_price <= max_price)
  ),
  constraint market_prices_unique_observation unique (
    mandi_id, crop_id, variety, grade, price_date
  )
);

create index if not exists market_prices_crop_date_idx
  on public.market_prices (crop_id, price_date desc);

comment on table public.market_prices is
  'Daily mandi price observations. Empty in Phase 2, filled from AGMARKNET in Phase 3.';
comment on column public.market_prices.modal_price is
  'Rupees per quintal, matching MSP and AGMARKNET convention.';

-- ---------------------------------------------------------------------------
-- msp — Minimum Support Price
-- ---------------------------------------------------------------------------
create table if not exists public.msp (
  id                uuid primary key default gen_random_uuid(),
  crop_id           uuid not null references public.crops (id),
  season            text not null,
  marketing_year    text not null,
  price_per_quintal numeric(12, 2) not null check (price_per_quintal > 0),
  effective_from    date,
  source            text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint msp_season_check check (season in ('rabi', 'kharif', 'other')),
  constraint msp_unique_year unique (crop_id, marketing_year, season)
);

comment on table public.msp is
  'Government of India Minimum Support Price, rupees per quintal.';

-- ---------------------------------------------------------------------------
-- weather — OBSERVED weather. EMPTY until Phase 3.
-- ---------------------------------------------------------------------------
create table if not exists public.weather (
  id            uuid primary key default gen_random_uuid(),
  -- Keyed by district, not by farm. A per-farm reading is derived in Phase 3
  -- by locating the farm centroid within a district.
  district      text not null,
  state         text not null,
  observed_on   date not null,
  temperature_c numeric(6, 2),
  rainfall_mm   numeric(8, 2) check (rainfall_mm >= 0),
  humidity_pct  numeric(5, 2) check (humidity_pct between 0 and 100),
  source        text not null,
  created_at    timestamptz not null default now(),

  constraint weather_unique_observation unique (district, state, observed_on)
);

create index if not exists weather_district_date_idx
  on public.weather (state, district, observed_on desc);

-- Forecasts get their own table in Phase 3: ML1_IMPLEMENTATION.md §46 requires
-- observed and forecast weather to stay distinguishable.
comment on table public.weather is
  'OBSERVED weather only. Empty in Phase 2. Forecasts get a separate table.';

-- ---------------------------------------------------------------------------
-- Triggers — reuse public.set_updated_at() from 0001, do not redefine it
-- ---------------------------------------------------------------------------
drop trigger if exists crops_set_updated_at on public.crops;
create trigger crops_set_updated_at
  before update on public.crops
  for each row execute function public.set_updated_at();

drop trigger if exists farm_crops_set_updated_at on public.farm_crops;
create trigger farm_crops_set_updated_at
  before update on public.farm_crops
  for each row execute function public.set_updated_at();

drop trigger if exists mandis_set_updated_at on public.mandis;
create trigger mandis_set_updated_at
  before update on public.mandis
  for each row execute function public.set_updated_at();

drop trigger if exists msp_set_updated_at on public.msp;
create trigger msp_set_updated_at
  before update on public.msp
  for each row execute function public.set_updated_at();

-- market_prices and weather are append-only observations: no updated_at column,
-- so no trigger.

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.crops         enable row level security;
alter table public.farm_crops    enable row level security;
alter table public.mandis        enable row level security;
alter table public.market_prices enable row level security;
alter table public.msp           enable row level security;
alter table public.weather       enable row level security;

-- Farmer-owned: same shape as the farms policy in 0001.
drop policy if exists "Farmers manage their own farm crops" on public.farm_crops;
create policy "Farmers manage their own farm crops"
  on public.farm_crops
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Reference data: readable by any signed-in farmer, writable by nobody.
-- No insert/update/delete policy exists, so with RLS on, only the service-role
-- key gets through. Nothing is granted to `anon`.
drop policy if exists "Signed-in farmers read the crop catalogue" on public.crops;
create policy "Signed-in farmers read the crop catalogue"
  on public.crops for select to authenticated using (true);

drop policy if exists "Signed-in farmers read mandis" on public.mandis;
create policy "Signed-in farmers read mandis"
  on public.mandis for select to authenticated using (true);

drop policy if exists "Signed-in farmers read market prices" on public.market_prices;
create policy "Signed-in farmers read market prices"
  on public.market_prices for select to authenticated using (true);

drop policy if exists "Signed-in farmers read MSP" on public.msp;
create policy "Signed-in farmers read MSP"
  on public.msp for select to authenticated using (true);

drop policy if exists "Signed-in farmers read weather" on public.weather;
create policy "Signed-in farmers read weather"
  on public.weather for select to authenticated using (true);
