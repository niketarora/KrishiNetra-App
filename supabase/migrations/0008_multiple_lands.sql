-- KrishiNetra 2.0 — Multiple lands per farmer
--
-- Adds index on user_id and created_at for fast listing and ordering of lands.
-- RLS already enforces auth.uid() = user_id for select, insert, update, delete.
-- farm_crops.farm_id is already foreign-keyed with ON DELETE CASCADE.

create index if not exists farms_user_created_idx
  on public.farms (user_id, created_at desc);
