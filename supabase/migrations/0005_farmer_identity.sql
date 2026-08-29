-- KrishiNetra 2.0 — Farmer identity foundation: phone-first auth, optional
-- email, demo location, notification preferences.
--
-- Phone is the farmer's primary contact/identity going forward, but it is
-- still not the primary key — `profiles.id` stays `auth.users.id`, per
-- IMPLEMENTATION.md's rule that Supabase Auth owns identity. `phone` is now
-- populated by `handle_new_user()` from signup metadata (mobile's demo-OTP
-- bridge writes it there — see `mobile/src/features/auth/phoneIdentity.ts`).
--
-- `email` here is a genuinely optional, farmer-entered contact field — it is
-- NOT the synthetic bridging email the demo-OTP flow uses to create the
-- Supabase Auth user, which never appears in the UI or in this column.

alter table public.profiles
  add column if not exists email text,

  -- FarmerLocation. Every column is nullable except `location_source`
  -- because the trigger below always seeds a value, but they stay nullable
  -- at the schema level so a farm created before this migration (or a row
  -- someone edits by hand) doesn't need a backfill. `location_source` is the
  -- swap point for Niket's future GPS work: write 'gps' once a real fix is
  -- read, or 'manual' if the farmer types their own place — nothing else
  -- about this shape needs to change.
  add column if not exists location_latitude  numeric(9, 6),
  add column if not exists location_longitude numeric(9, 6),
  add column if not exists location_city      text,
  add column if not exists location_district  text,
  add column if not exists location_state     text,
  add column if not exists location_country   text,
  add column if not exists location_source    text not null default 'demo',

  -- Notification preferences. These are preferences only — nothing in this
  -- codebase sends an SMS or places a call yet (IMPLEMENTATION.md rule: no
  -- Exotel/Twilio, no real communication infra in this stage).
  add column if not exists in_app_alerts boolean not null default true,
  add column if not exists sms_alerts    boolean not null default true,
  add column if not exists voice_alerts  boolean not null default true;

alter table public.profiles
  drop constraint if exists profiles_location_source_check;
alter table public.profiles
  add constraint profiles_location_source_check
  check (location_source in ('demo', 'gps', 'manual'));

comment on column public.profiles.email is
  'Optional farmer-entered contact email. Distinct from the synthetic bridging email the demo-OTP flow uses for Supabase Auth.';
comment on column public.profiles.location_source is
  'How the location columns were populated: demo (placeholder, e.g. Pratapgarh), gps, or manual.';

-- ---------------------------------------------------------------------------
-- handle_new_user() — also seed phone (from signup metadata, phone-first
-- flow) and a demo location, so every new farmer starts from a known place
-- rather than nulls. Pratapgarh, Rajasthan is a development-only placeholder,
-- never presented as a real GPS fix (see mobile ProfileSetupScreen/Profile).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, phone, language,
    location_latitude, location_longitude,
    location_city, location_district, location_state, location_country, location_source
  )
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'language', ''), 'en'),
    24.031111, 74.779444,
    'Pratapgarh', 'Pratapgarh', 'Rajasthan', 'India', 'demo'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- No RLS changes: "Farmers manage their own profile" (0001) already covers
-- every column on this table with `using (auth.uid() = id)`, including all
-- of the ones added here.
