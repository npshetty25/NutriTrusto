-- ============================================================
-- Nutri-Trust — custom recipes (your own recipes, with favourites)
-- Run this in Supabase: SQL Editor > New Query > paste > Run.
--
-- Creates one new table. Safe to run more than once. Deletes nothing and
-- changes no existing table. Each person can only see and change their own
-- recipes (row-level security), the same rule shopping_list_items uses.
--
-- Until this has run, the "My recipes" section shows a note saying so, and
-- the rest of the recipes page works as before.
-- ============================================================

create table if not exists public.custom_recipes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null check (char_length(name) between 1 and 80),
  ingredients  text[] not null default '{}' check (cardinality(ingredients) between 1 and 60),
  steps        text[] not null default '{}' check (cardinality(steps) between 1 and 40),
  is_favourite boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists custom_recipes_user_idx on public.custom_recipes (user_id, created_at desc);

alter table public.custom_recipes enable row level security;

drop policy if exists "Users manage their own custom recipes" on public.custom_recipes;
create policy "Users manage their own custom recipes"
  on public.custom_recipes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Make PostgREST see the new table straight away.
notify pgrst, 'reload schema';
