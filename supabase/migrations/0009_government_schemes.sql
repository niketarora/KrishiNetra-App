-- KrishiNetra 2.0 — Government Schemes reference table
--
-- Real dataset of 3,235 government scheme records.
-- Public read-only for authenticated farmers, service-role write only.

create table if not exists public.government_schemes (
  row_id text primary key,                 -- "<scheme_id>_<state_slug>"
  scheme_id text not null,
  state text not null,
  scheme_scope text not null check (scheme_scope in ('CENTRAL','STATE')),
  name text not null,
  short_title text,
  category text,
  what_is_it text,
  potential_benefit text,
  who_may_be_eligible text,
  documents text[] not null default '{}',
  how_to_apply text,
  official_source text,
  myscheme_url text,
  department text,
  tags text[] not null default '{}',
  application_modes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists government_schemes_state_idx
  on public.government_schemes (state);

create index if not exists government_schemes_state_scope_idx
  on public.government_schemes (state, scheme_scope);

create index if not exists government_schemes_scheme_id_idx
  on public.government_schemes (scheme_id);

create index if not exists government_schemes_tags_idx
  on public.government_schemes using gin (tags);

-- ---------------------------------------------------------------------------
-- RLS and Triggers
-- ---------------------------------------------------------------------------
alter table public.government_schemes enable row level security;

drop policy if exists "Authenticated users can read government schemes" on public.government_schemes;
create policy "Authenticated users can read government schemes"
  on public.government_schemes
  for select
  to authenticated
  using (true);

drop trigger if exists government_schemes_set_updated_at on public.government_schemes;
create trigger government_schemes_set_updated_at
  before update on public.government_schemes
  for each row execute function public.set_updated_at();

comment on table public.government_schemes is
  'Central and state government agricultural schemes for farmer discovery.';
