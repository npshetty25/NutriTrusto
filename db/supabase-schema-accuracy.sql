-- ============================================================
-- Nutri-Trust — accuracy improvements
-- Run this in Supabase: SQL Editor > New Query > paste > Run.
--
-- Adds two columns to pantry_items and one new table. Safe to run more than
-- once, deletes nothing, and changes no existing data.
--
--   pantry_items.quantity     how much is left, as the person typed it
--                             ("500 g", "1 litre", "half a packet")
--   pantry_items.expiry_kind  which date the pack printed:
--                               'use_by'       a safety date — don't eat after
--                               'best_before'  a quality date — may be past its best
--                               NULL           not known
--   recipe_feedback           whether a generated recipe was any good,
--                             so prompt changes can be judged on real use
--
-- Until this has run, the app hides the quantity field and the feedback
-- buttons, and keeps treating every printed date the same way.
-- ============================================================

alter table public.pantry_items
  add column if not exists quantity text,
  add column if not exists expiry_kind text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pantry_items_quantity_length') then
    alter table public.pantry_items
      add constraint pantry_items_quantity_length
      check (quantity is null or char_length(quantity) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pantry_items_expiry_kind_check') then
    alter table public.pantry_items
      add constraint pantry_items_expiry_kind_check
      check (expiry_kind is null or expiry_kind in ('use_by', 'best_before'));
  end if;
end $$;

create table if not exists public.recipe_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null check (char_length(title) between 1 and 120),
  base_dish   text check (base_dish is null or char_length(base_dish) <= 120),
  diet        text check (diet is null or char_length(diet) <= 20),
  rating      text not null check (rating in ('up', 'down', 'cooked')),
  created_at  timestamptz not null default now()
);

create index if not exists recipe_feedback_user_idx on public.recipe_feedback (user_id, created_at desc);

alter table public.recipe_feedback enable row level security;

drop policy if exists "Users manage their own recipe feedback" on public.recipe_feedback;
create policy "Users manage their own recipe feedback"
  on public.recipe_feedback
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
