-- KrishiNetra 2.0 — GPS field location accuracy
--
-- Adds location_accuracy to record the precision of the GPS fix used to
-- capture the farm boundary (e.g. from watchPositionAsync on walk or
-- getCurrentPositionAsync on draw).
--
-- Nullable: null means unknown/legacy (never 0). Numeric(8, 2) supports
-- coarse cell-only fixes in meters up to tens of thousands without overflow.

alter table public.farms
  add column if not exists location_accuracy numeric(8, 2);

comment on column public.farms.location_accuracy is
  'GPS fix accuracy in meters when the boundary was captured. Null means unknown, never 0.';
