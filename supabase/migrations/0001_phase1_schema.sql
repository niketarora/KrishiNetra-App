-- KrishiNetra 2.0 — Phase 1 schema
--
-- Scope: exactly what the first farmer journey needs (TRD §8,
-- IMPLEMENTATION.md §6). Crops, mandis, market prices, weather, buyers, lots,
-- offers and transactions are Phase 2+ and are deliberately absent.
--
-- Passwords live in auth.users and are managed entirely by Supabase Auth.
-- There is no application password column anywhere in this file, by design.

-- ---------------------------------------------------------------------------
-- profiles — farmer display data, keyed to the auth user
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  phone      text,
  language   text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Farmer profile. One row per auth user, created by handle_new_user().';

-- ---------------------------------------------------------------------------
-- farms — the drawn field boundary and its measurements
-- ---------------------------------------------------------------------------
create table if not exists public.farms (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text,
  -- GeoJSON Polygon: {"type":"Polygon","coordinates":[[[lng,lat],…,[lng,lat]]]}
  -- JSONB rather than PostGIS: Phase 1 runs no spatial queries, and PostGIS can
  -- be added later as a generated column without migrating this data.
  boundary       jsonb not null,
  area_sq_meters numeric(14, 2) not null check (area_sq_meters > 0),
  area_acres     numeric(12, 4) not null check (area_acres > 0),
  area_hectares  numeric(12, 4) not null check (area_hectares > 0),
  centroid_lat   numeric(9, 6) not null check (centroid_lat between -90 and 90),
  centroid_lng   numeric(9, 6) not null check (centroid_lng between -180 and 180),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- A polygon needs at least 4 positions in its ring (3 corners + the repeated
  -- closing point). Rejects malformed boundaries at the database boundary.
  constraint farms_boundary_is_polygon check (boundary ->> 'type' = 'Polygon'),
  constraint farms_boundary_has_ring check (
    jsonb_array_length(boundary -> 'coordinates' -> 0) >= 4
  )
);

create index if not exists farms_user_id_idx on public.farms (user_id);

comment on table public.farms is
  'Farmer-drawn field boundary with geodesic area in three units.';

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists farms_set_updated_at on public.farms;
create trigger farms_set_updated_at
  before update on public.farms
  for each row execute function public.set_updated_at();

-- Create the profile row the moment Supabase Auth creates the user, so the app
-- never has to handle a signed-in user with no profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, language)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'language', ''), 'en')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security — a farmer reaches their own rows and nobody else's
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.farms    enable row level security;

drop policy if exists "Farmers manage their own profile" on public.profiles;
create policy "Farmers manage their own profile"
  on public.profiles
  for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Farmers manage their own farms" on public.farms;
create policy "Farmers manage their own farms"
  on public.farms
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Nothing is granted to `anon`: an unauthenticated client sees no rows at all.
