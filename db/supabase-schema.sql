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
