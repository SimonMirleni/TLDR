-- ReadLater Digest — schema reference (documentation only).
-- This file is NOT applied automatically. Run it once in the Supabase SQL Editor
-- against your project. After applying, regenerate types:
--   supabase gen types typescript --project-id <ref> --schema public > db/generated.ts

-- ---------------------------------------------------------------------------
-- resources: per-user FIFO queue of saved pages
-- ---------------------------------------------------------------------------
create table public.resources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url         text not null,
  content     text not null,
  status      text not null default 'pending'
              check (status in ('pending', 'consumed')),
  created_at  timestamptz not null default now(),
  consumed_at timestamptz
);

create index resources_user_status_created_idx
  on public.resources (user_id, status, created_at);

-- ---------------------------------------------------------------------------
-- settings: one row per user (lazy-created on first save)
-- ---------------------------------------------------------------------------
create table public.settings (
  user_id                  uuid primary key
                           references auth.users(id) on delete cascade,
  tone_prompt              text not null default '',
  resources_per_newsletter int  not null default 3
                           check (resources_per_newsletter >= 1),
  updated_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.resources enable row level security;
alter table public.settings  enable row level security;

create policy "resources: owner select"
  on public.resources for select
  using (auth.uid() = user_id);

create policy "resources: owner insert"
  on public.resources for insert
  with check (auth.uid() = user_id);

create policy "resources: owner update"
  on public.resources for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "settings: owner select"
  on public.settings for select
  using (auth.uid() = user_id);

create policy "settings: owner insert"
  on public.settings for insert
  with check (auth.uid() = user_id);

create policy "settings: owner update"
  on public.settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
