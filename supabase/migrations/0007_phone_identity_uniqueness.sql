-- KrishiNetra 2.0 — Phone identity uniqueness
--
-- Ensures each phone number maps to at most one profile.
-- Deduplicates pre-existing rows inside a DO block, setting duplicates to NULL
-- and raising a notice for each row touched so the operation is transparent.

do $$
declare
  r record;
begin
  for r in (
    select id, phone, created_at
    from (
      select id, phone, created_at,
             row_number() over (partition by phone order by created_at asc) as rn
      from public.profiles
      where phone is not null
    ) ranked
    where rn > 1
  ) loop
    raise notice 'Deduplicating profile % with duplicate phone % (created at %)', r.id, r.phone, r.created_at;
    update public.profiles set phone = null where id = r.id;
  end loop;
end;
$$;

create unique index if not exists profiles_phone_unique_idx
  on public.profiles (phone)
  where phone is not null;
