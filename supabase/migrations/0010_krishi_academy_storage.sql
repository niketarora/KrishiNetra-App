-- KrishiNetra 2.0 — Krishi Academy public storage bucket
--
-- Creates the public krishi-academy storage bucket for tutorial videos and assets.
-- Adds a public select policy on storage.objects.

insert into storage.buckets (id, name, public)
values ('krishi-academy', 'krishi-academy', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public Access for Krishi Academy'
  ) then
    create policy "Public Access for Krishi Academy"
      on storage.objects for select
      using (bucket_id = 'krishi-academy');
  end if;
end;
$$;
