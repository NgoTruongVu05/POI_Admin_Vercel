-- Supabase (Postgres) schema + RLS policies for POI Admin UI
-- Run in Supabase SQL editor.

-- =========================================
-- Tables
-- =========================================

create table if not exists public.pois (
  id text primary key,
  name varchar(200) not null,
  description text null,
  lat double precision not null,
  lng double precision not null
);

create table if not exists public.languages (
  code varchar(2) primary key,
  name varchar(100) not null,
  is_active boolean not null default true
);

create table if not exists public.poitranslations (
  poi_id text not null references public.pois(id) on delete cascade on update cascade,
  lang_code varchar(2) not null references public.languages(code) on delete cascade on update cascade,
  description text null,
  primary key (poi_id, lang_code)
);

-- =========================================
-- Row Level Security (RLS)
-- Policy: only authenticated users can read/write.
-- (Recommended) Disable public signups in Supabase Auth for an admin-only panel.
-- =========================================

alter table public.pois enable row level security;
alter table public.languages enable row level security;
alter table public.poitranslations enable row level security;

drop policy if exists "pois_auth_all" on public.pois;
create policy "pois_auth_all" on public.pois
for all
to authenticated
using (true)
with check (true);

drop policy if exists "languages_auth_all" on public.languages;
create policy "languages_auth_all" on public.languages
for all
to authenticated
using (true)
with check (true);

drop policy if exists "poitranslations_auth_all" on public.poitranslations;
create policy "poitranslations_auth_all" on public.poitranslations
for all
to authenticated
using (true)
with check (true);

-- =========================================
-- Optional seed
-- =========================================

insert into public.languages (code, name, is_active)
values
  ('vi', '(VN) Tiếng Việt', true),
  ('en', '(US) English', true)
on conflict (code) do nothing;
