-- ============================================================
-- Nutri-Trust — database hardening (2026-08)
-- Run this in Supabase: SQL Editor > New Query
--
-- Safe to run on an existing database, and safe to run twice. Every
-- statement is idempotent, and nothing here deletes a row or drops a
-- column, and nothing changes an existing column's type. The
-- purchase_date type migration lives in its own file so it can be run
-- separately, after the demo.
--
-- Run this AFTER supabase-schema.sql and supabase-schema-additions.sql.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Indexes
-- ────────────────────────────────────────────────────────────
-- Before this file the six tables had exactly one index each: the primary
-- key. Every other lookup was a sequential scan of the whole table.
--
-- The first index below is the one that matters most, and it is not
-- obvious. household_members has primary key (household_id, user_id), so
-- its only index is ordered household_id first. my_household_ids() queries
-- `where user_id = auth.uid()` — the SECOND column — which a composite
-- index cannot serve efficiently. That function is called by the RLS
-- policy on pantry_items, so it ran on effectively every pantry read and
-- write in the application.

create index if not exists household_members_user_id_idx
  on public.household_members (user_id);

-- pantry_items is filtered by owner or by household on every load, and
-- sorted by expiry. Partial index on household_id skips the rows that
-- have none, which is most of them for a single-user pantry.
create index if not exists pantry_items_user_id_idx
  on public.pantry_items (user_id);

create index if not exists pantry_items_household_id_idx
  on public.pantry_items (household_id)
  where household_id is not null;

create index if not exists pantry_items_user_days_left_idx
  on public.pantry_items (user_id, days_left);

-- The shopping list is always read as "unchecked first, newest first".
create index if not exists shopping_list_items_user_checked_created_idx
  on public.shopping_list_items (user_id, checked, created_at desc);

-- Scan history is read newest-first and grows without bound.
create index if not exists scan_history_user_scanned_at_idx
  on public.scan_history (user_id, scanned_at desc);

-- item_outcomes is aggregated per user by the impact dashboard, and the
-- household leaderboard groups the same table across several users.
create index if not exists item_outcomes_user_removed_at_idx
  on public.item_outcomes (user_id, removed_at desc);

-- Invite codes are looked up by exact value in join_household_by_code().
-- The unique constraint already provides this index, so nothing is added
-- here — noted so the omission reads as deliberate.


-- ────────────────────────────────────────────────────────────
-- 2. Length and sanity constraints
-- ────────────────────────────────────────────────────────────
-- The API routes validate their inputs, but pantry rows are written by the
-- browser straight to PostgREST, which bypasses those routes entirely.
-- Nothing stopped a client inserting a 10 MB item name. RLS controls WHO
-- can write a row; it says nothing about WHAT is in it.
--
-- The bounds are far above any real value: the longest genuine product
-- name in Open Food Facts is comfortably under 200 characters.
--
-- Each constraint is added only if absent, so re-running is harmless.
--
-- Every one is added NOT VALID. That is deliberate: NOT VALID still
-- enforces the rule on every INSERT and UPDATE from now on, but skips the
-- scan of rows that already exist. Without it, a single legacy row that
-- breaks a rule would abort the whole migration — which is not something
-- to discover the morning of a demo.
--
-- Section 6 has a query that finds any existing row that would fail, and
-- the ALTER ... VALIDATE CONSTRAINT statements to run once it comes back
-- empty.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pantry_items_name_len') then
    alter table public.pantry_items
      add constraint pantry_items_name_len
      check (char_length(name) between 1 and 200) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'pantry_items_ingredients_len') then
    alter table public.pantry_items
      add constraint pantry_items_ingredients_len
      check (ingredients_text is null or char_length(ingredients_text) <= 20000) not valid;
  end if;

  -- days_left holds the shelf life recorded at purchase (see section 3).
  -- Ten years is absurd for food and still leaves room for tinned goods.
  if not exists (select 1 from pg_constraint where conname = 'pantry_items_days_left_range') then
    alter table public.pantry_items
      add constraint pantry_items_days_left_range
      check (days_left between 0 and 3650) not valid;
  end if;

  -- health_score is the NutriTrust 1-5 reading, stored as text. Anything
  -- outside that is a bug upstream, and the card renders it verbatim.
  if not exists (select 1 from pg_constraint where conname = 'pantry_items_health_score_fmt') then
    alter table public.pantry_items
      add constraint pantry_items_health_score_fmt
      check (
        health_score is null
        or (health_score ~ '^[0-9](\.[0-9])?$' and health_score::numeric between 0 and 5)
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'shopping_list_items_name_len') then
    alter table public.shopping_list_items
      add constraint shopping_list_items_name_len
      check (char_length(name) between 1 and 300) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'shopping_list_items_recipe_len') then
    alter table public.shopping_list_items
      add constraint shopping_list_items_recipe_len
      check (source_recipe is null or char_length(source_recipe) <= 200) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'scan_history_product_name_len') then
    alter table public.scan_history
      add constraint scan_history_product_name_len
      check (char_length(product_name) between 1 and 300) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'item_outcomes_name_len') then
    alter table public.item_outcomes
      add constraint item_outcomes_name_len
      check (char_length(name) between 1 and 200) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'households_name_len') then
    alter table public.households
      add constraint households_name_len
      check (char_length(name) between 1 and 100) not valid;
  end if;
end $$;


-- ────────────────────────────────────────────────────────────
-- 3. Column documentation
-- ────────────────────────────────────────────────────────────
-- days_left does NOT hold days remaining. It holds the shelf life recorded
-- at purchase time, and the remaining days are computed in the application
-- from purchase_date plus this value. The name has caused real bugs, and a
-- rename would break every existing query, so the meaning is recorded here
-- where anyone reading the schema will find it.

comment on column public.pantry_items.days_left is
  'Shelf life in days as recorded at purchase — NOT days remaining. Remaining days = days_left - (now() - purchase_date). Misleading name kept for backward compatibility.';

comment on column public.pantry_items.purchase_date is
  'When the item was bought. Read from the receipt where one was scanned, otherwise the time the row was created.';

comment on column public.pantry_items.health_score is
  'NutriTrust score 1-5 as text, only for items actually scanned. NULL means never scanned — the card shows a dash rather than inventing a grade.';

comment on column public.pantry_items.ingredients_text is
  'Raw ingredient text from Open Food Facts. NULL means no data was available, which is why allergen status degrades to "unknown" instead of "safe".';

comment on column public.item_outcomes.outcome is
  'Recorded from the button the user actually pressed: "used" from Used it, "expired" from the remove action. Previously inferred from whether days_left was positive.';

comment on table public.item_outcomes is
  'Append-only log of what happened to each pantry item after it left the pantry. Drives the impact dashboard.';


-- ────────────────────────────────────────────────────────────
-- 4. Clean up households nobody belongs to
-- ────────────────────────────────────────────────────────────
-- household_members cascades on user delete, and members can remove
-- themselves, so a household can end up with zero members. Nothing removed
-- it, and its invite code stayed valid forever — anyone holding that code
-- could later join an empty household that no longer belongs to anyone.

create or replace function public.delete_household_if_empty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.household_members where household_id = old.household_id
  ) then
    delete from public.households where id = old.household_id;
  end if;
  return null;
end;
$$;

drop trigger if exists household_members_cleanup on public.household_members;
create trigger household_members_cleanup
  after delete on public.household_members
  for each row execute function public.delete_household_if_empty();


-- ────────────────────────────────────────────────────────────
-- 5. Longer invite codes for new households
-- ────────────────────────────────────────────────────────────
-- The default was 8 hex characters. join_household_by_code() is callable by
-- any authenticated user with no attempt limit, so the code is the only
-- thing standing between a stranger and a family's shared pantry. Twelve
-- characters raises the search space from about 4.3e9 to about 2.8e14.
-- Existing codes keep working; only newly created households get the
-- longer form.

alter table public.households
  alter column invite_code set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);


-- ────────────────────────────────────────────────────────────
-- 6. Verify
-- ────────────────────────────────────────────────────────────
-- Run these separately once the file above has completed.
--
-- (a) What landed. Expect 7 index rows and 9 constraint rows.
--
--   select indexname from pg_indexes
--    where schemaname = 'public' and indexname like '%_idx' order by 1;
--
--   select conname, convalidated from pg_constraint
--    where conname like '%_len' or conname like '%_range' or conname like '%_fmt'
--    order by 1;
--
-- (b) Does any EXISTING row break the new rules? An empty result means the
--     constraints can be validated safely.
--
--   select 'pantry_items.name' as what, count(*) from public.pantry_items
--     where char_length(name) not between 1 and 200
--   union all select 'pantry_items.days_left', count(*) from public.pantry_items
--     where days_left not between 0 and 3650
--   union all select 'pantry_items.health_score', count(*) from public.pantry_items
--     where health_score is not null and health_score !~ '^[0-9](\.[0-9])?$'
--   union all select 'shopping_list_items.name', count(*) from public.shopping_list_items
--     where char_length(name) not between 1 and 300
--   union all select 'scan_history.product_name', count(*) from public.scan_history
--     where char_length(product_name) not between 1 and 300
--   union all select 'item_outcomes.name', count(*) from public.item_outcomes
--     where char_length(name) not between 1 and 200
--   union all select 'households.name', count(*) from public.households
--     where char_length(name) not between 1 and 100;
--
-- (c) If every count above is 0, promote the constraints from NOT VALID to
--     fully validated. Each one is a quick scan on tables this size.
--
--   alter table public.pantry_items validate constraint pantry_items_name_len;
--   alter table public.pantry_items validate constraint pantry_items_ingredients_len;
--   alter table public.pantry_items validate constraint pantry_items_days_left_range;
--   alter table public.pantry_items validate constraint pantry_items_health_score_fmt;
--   alter table public.shopping_list_items validate constraint shopping_list_items_name_len;
--   alter table public.shopping_list_items validate constraint shopping_list_items_recipe_len;
--   alter table public.scan_history validate constraint scan_history_product_name_len;
--   alter table public.item_outcomes validate constraint item_outcomes_name_len;
--   alter table public.households validate constraint households_name_len;
