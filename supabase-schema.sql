-- ============================================================
-- SmartPantry — Run this in Supabase: SQL Editor > New Query
-- ============================================================

-- Pantry items table
create table if not exists public.pantry_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  days_left   integer not null,
  risk        text check (risk in ('high', 'medium', 'low')) not null default 'low',
  purchase_date text not null default to_char(now(), 'Mon DD, YYYY'),
  created_at  timestamptz default now()
);

-- Row Level Security: users can only access their own items
alter table public.pantry_items enable row level security;

drop policy if exists "Users manage their own pantry" on public.pantry_items;
create policy "Users manage their own pantry"
  on public.pantry_items
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Enable real-time for live household sync
alter publication supabase_realtime add table public.pantry_items;

-- ============================================================
-- Rescue Streaks + Social Accountability
-- ============================================================

create table if not exists public.rescue_daily_stats (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  date_key      date not null,
  circle_id     text not null default 'solo',
  display_name  text not null default 'Anonymous',
  rescued_items integer not null default 0,
  wasted_items  integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, date_key)
);

alter table public.rescue_daily_stats enable row level security;

drop policy if exists "Users manage their own rescue stats" on public.rescue_daily_stats;
create policy "Users manage their own rescue stats"
  on public.rescue_daily_stats
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users view same circle rescue stats" on public.rescue_daily_stats;
create policy "Users view same circle rescue stats"
  on public.rescue_daily_stats
  for select
  using (
    exists (
      select 1
      from public.rescue_daily_stats mine
      where mine.user_id = auth.uid()
        and mine.date_key = rescue_daily_stats.date_key
        and mine.circle_id = rescue_daily_stats.circle_id
    )
  );

create index if not exists rescue_daily_stats_date_circle_idx
  on public.rescue_daily_stats (date_key, circle_id, rescued_items desc, wasted_items asc);

-- Enable realtime updates for accountability widgets
alter publication supabase_realtime add table public.rescue_daily_stats;
