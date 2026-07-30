-- Tools Portal — Supabase schema
-- Covers the shared portal login plus the "Widget Scenario Specs" tool's
-- data. Safe to re-run: paste this whole file into the Supabase SQL Editor
-- and click Run, whether this is your first time or you're re-applying the
-- login-required policies.
--
-- Each future tool can add its own tables the same way: create them here
-- (or in a new file), enable RLS, and follow the same public-read /
-- authenticated-write pattern so the shared portal login protects it too.

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

-- The whole portal sits behind a shared login (Supabase Auth, see README).
-- Anyone can read (needed for "Share" links to work without logging in),
-- but only a signed-in session can write.
drop policy if exists "public full access" on projects;
drop policy if exists "public read" on projects;
drop policy if exists "authenticated insert" on projects;
drop policy if exists "authenticated update" on projects;
drop policy if exists "authenticated delete" on projects;
create policy "public read" on projects for select using (true);
create policy "authenticated insert" on projects for insert with check (auth.role() = 'authenticated');
create policy "authenticated update" on projects for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated delete" on projects for delete using (auth.role() = 'authenticated');

drop policy if exists "public full access" on categories;
drop policy if exists "public read" on categories;
drop policy if exists "authenticated insert" on categories;
drop policy if exists "authenticated update" on categories;
drop policy if exists "authenticated delete" on categories;
create policy "public read" on categories for select using (true);
create policy "authenticated insert" on categories for insert with check (auth.role() = 'authenticated');
create policy "authenticated update" on categories for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated delete" on categories for delete using (auth.role() = 'authenticated');

drop policy if exists "public full access" on scenarios;
drop policy if exists "public read" on scenarios;
drop policy if exists "authenticated insert" on scenarios;
drop policy if exists "authenticated update" on scenarios;
drop policy if exists "authenticated delete" on scenarios;
create policy "public read" on scenarios for select using (true);
create policy "authenticated insert" on scenarios for insert with check (auth.role() = 'authenticated');
create policy "authenticated update" on scenarios for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated delete" on scenarios for delete using (auth.role() = 'authenticated');

drop policy if exists "public full access" on media;
drop policy if exists "public read" on media;
drop policy if exists "authenticated insert" on media;
drop policy if exists "authenticated update" on media;
drop policy if exists "authenticated delete" on media;
create policy "public read" on media for select using (true);
create policy "authenticated insert" on media for insert with check (auth.role() = 'authenticated');
create policy "authenticated update" on media for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated delete" on media for delete using (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "public read media bucket" on storage.objects;
drop policy if exists "public upload media bucket" on storage.objects;
drop policy if exists "public update media bucket" on storage.objects;
drop policy if exists "public delete media bucket" on storage.objects;
drop policy if exists "authenticated upload media bucket" on storage.objects;
drop policy if exists "authenticated update media bucket" on storage.objects;
drop policy if exists "authenticated delete media bucket" on storage.objects;
create policy "public read media bucket" on storage.objects
  for select using (bucket_id = 'media');
create policy "authenticated upload media bucket" on storage.objects
  for insert with check (bucket_id = 'media' and auth.role() = 'authenticated');
create policy "authenticated update media bucket" on storage.objects
  for update using (bucket_id = 'media' and auth.role() = 'authenticated');
create policy "authenticated delete media bucket" on storage.objects
  for delete using (bucket_id = 'media' and auth.role() = 'authenticated');
