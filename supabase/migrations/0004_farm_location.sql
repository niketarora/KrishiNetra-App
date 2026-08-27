-- KrishiNetra 2.0 — Phase 2.5: resolving a farm to a place
--
-- The weather table is keyed by (district, state), but a farm only knows its
-- centroid. IMPLEMENTATION_PHASE2_5.md §3.3 forbids guessing a district from
-- coordinates, so the district is *resolved* once by a reverse-geocode lookup
-- and stored here with the source of that lookup.
--
-- All three columns are nullable on purpose. A farm drawn before this migration
-- has no resolved district, and a farm whose lookup failed has none either. In
-- both cases /api/v1/weather keeps returning its existing unavailable state —
-- which is the honest answer, and the one rule 13 requires.

alter table public.farms
  add column if not exists district        text,
  add column if not exists state           text,
  add column if not exists location_source text;

comment on column public.farms.district is
  'District resolved from the centroid by reverse geocoding. Null when unresolved.';
comment on column public.farms.state is
  'State resolved from the centroid by reverse geocoding. Null when unresolved.';
comment on column public.farms.location_source is
  'Which provider resolved district/state, and when. Null when unresolved.';

-- Weather lookups filter farms by the place they resolved to.
create index if not exists farms_district_idx on public.farms (state, district);

-- No new policy: the existing "Farmers manage their own farms" policy from
-- 0001 covers every column on this table, including these three.
