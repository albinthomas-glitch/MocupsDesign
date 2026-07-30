-- Widget Scenario Spec — Supabase schema
-- Safe to re-run: paste this whole file into the Supabase SQL Editor and
-- click Run, whether this is your first time or you're reverting the
-- login/password update (no login for now -- see README).

create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  problem text,
  placement_page text,
  placement_position text,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists scenarios (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  trigger_text text,
  message text,
  popup text,
  backend text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references scenarios(id) on delete cascade,
  storage_path text not null,
  media_type text not null check (media_type in ('image','video')),
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;
alter table categories enable row level security;
alter table scenarios enable row level security;
alter table media enable row level security;

-- No login for now (see README) -- every visitor uses the public anon key,
-- so these policies allow anyone with that key to read/write. Don't put
-- sensitive data in this project, and don't hand the anon key out beyond
-- people you trust.
drop policy if exists "public read" on projects;
drop policy if exists "authenticated insert" on projects;
drop policy if exists "authenticated update" on projects;
drop policy if exists "authenticated delete" on projects;
drop policy if exists "public full access" on projects;
create policy "public full access" on projects for all using (true) with check (true);

drop policy if exists "public read" on categories;
drop policy if exists "authenticated insert" on categories;
drop policy if exists "authenticated update" on categories;
drop policy if exists "authenticated delete" on categories;
drop policy if exists "public full access" on categories;
create policy "public full access" on categories for all using (true) with check (true);

drop policy if exists "public read" on scenarios;
drop policy if exists "authenticated insert" on scenarios;
drop policy if exists "authenticated update" on scenarios;
drop policy if exists "authenticated delete" on scenarios;
drop policy if exists "public full access" on scenarios;
create policy "public full access" on scenarios for all using (true) with check (true);

drop policy if exists "public read" on media;
drop policy if exists "authenticated insert" on media;
drop policy if exists "authenticated update" on media;
drop policy if exists "authenticated delete" on media;
drop policy if exists "public full access" on media;
create policy "public full access" on media for all using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "public upload media bucket" on storage.objects;
drop policy if exists "public update media bucket" on storage.objects;
drop policy if exists "public delete media bucket" on storage.objects;
drop policy if exists "authenticated upload media bucket" on storage.objects;
drop policy if exists "authenticated update media bucket" on storage.objects;
drop policy if exists "authenticated delete media bucket" on storage.objects;
drop policy if exists "public read media bucket" on storage.objects;
create policy "public read media bucket" on storage.objects
  for select using (bucket_id = 'media');
create policy "public upload media bucket" on storage.objects
  for insert with check (bucket_id = 'media');
create policy "public update media bucket" on storage.objects
  for update using (bucket_id = 'media');
create policy "public delete media bucket" on storage.objects
  for delete using (bucket_id = 'media');
