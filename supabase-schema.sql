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

create table if not exists tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text not null default '🧩',
  href text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table tools enable row level security;

drop policy if exists "public read" on tools;
drop policy if exists "authenticated insert" on tools;
drop policy if exists "authenticated update" on tools;
drop policy if exists "authenticated delete" on tools;
create policy "public read" on tools for select using (true);
create policy "authenticated insert" on tools for insert with check (auth.role() = 'authenticated');
create policy "authenticated update" on tools for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated delete" on tools for delete using (auth.role() = 'authenticated');

-- Seed the menu with the tool that already exists, if it's not there yet.
insert into tools (name, description, icon, href, sort_order)
select 'Widget Scenario Specs',
       'Document widget/feature UX scenarios — triggers, messages, popups, backend behavior — for manager review.',
       '🧩',
       'tools/widget-scenario-spec/index.html',
       0
where not exists (select 1 from tools where href = 'tools/widget-scenario-spec/index.html');

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
  message_code text,
  popup text,
  popup_code text,
  backend text,
  mockup_code text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
-- Adds the *_code columns for scenarios tables created before this update.
alter table scenarios add column if not exists message_code text;
alter table scenarios add column if not exists popup_code text;
alter table scenarios add column if not exists mockup_code text;

create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references scenarios(id) on delete cascade,
  storage_path text not null,
  media_type text not null check (media_type in ('image','video')),
  section text not null default 'mockup',
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
-- Adds the section column (which block a file belongs to) for media
-- tables created before this update.
alter table media add column if not exists section text not null default 'mockup';
alter table media drop constraint if exists media_section_check;
alter table media add constraint media_section_check check (section in ('mockup', 'message', 'popup'));

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

-- Code Store tool: snippets live directly in Supabase (plain text rows),
-- not in GitHub -- no separate token/repo setup needed for this tool.
create table if not exists snippets (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  code text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table snippets enable row level security;

drop policy if exists "public read" on snippets;
drop policy if exists "authenticated insert" on snippets;
drop policy if exists "authenticated update" on snippets;
drop policy if exists "authenticated delete" on snippets;
create policy "public read" on snippets for select using (true);
create policy "authenticated insert" on snippets for insert with check (auth.role() = 'authenticated');
create policy "authenticated update" on snippets for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated delete" on snippets for delete using (auth.role() = 'authenticated');

insert into tools (name, description, icon, href, sort_order)
select 'Code Store',
       'Paste code, preview it with syntax highlighting, and save it as a snippet.',
       '📝',
       'tools/code-store/index.html',
       1
where not exists (select 1 from tools where href = 'tools/code-store/index.html');

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
