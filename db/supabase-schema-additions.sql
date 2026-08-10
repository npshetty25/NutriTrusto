-- ============================================================
-- Nutri-Trust — feature additions (2026-07)
-- Run this in Supabase: SQL Editor > New Query
-- Safe to run on an existing database — every statement is idempotent
-- (create if not exists / drop policy if exists) and purely additive:
-- it does not touch or remove any existing row in pantry_items.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Households — shared pantry
-- ────────────────────────────────────────────────────────────

create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'My Household',
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);

create table if not exists public.household_members (
  household_id uuid references public.households(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  joined_at    timestamptz default now(),
  primary key (household_id, user_id)
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- A policy on household_members cannot safely subquery household_members
-- itself — evaluating the subquery re-triggers that same table's RLS
-- policy, which subqueries it again, forever ("infinite recursion detected
-- in policy for relation household_members", Postgres error 42P17). Route
-- the lookup through a SECURITY DEFINER function instead: functions created
-- via the SQL Editor are owned by a role that bypasses RLS, so the query
-- inside it runs once, plainly, breaking the cycle.
create or replace function public.my_household_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

grant execute on function public.my_household_ids() to authenticated;

-- Members can see (and rename) the household(s) they belong to.
drop policy if exists "Members can view their household" on public.households;
create policy "Members can view their household"
  on public.households
  for select
  using (id in (select public.my_household_ids()));

drop policy if exists "Members can update their household" on public.households;
create policy "Members can update their household"
  on public.households
  for update
  using (id in (select public.my_household_ids()));

-- Any authenticated user can create a household, becoming its creator.
drop policy if exists "Users can create households" on public.households;
create policy "Users can create households"
  on public.households
  for insert
  with check (auth.uid() = created_by);

-- Creating a household is done via this function rather than a plain
-- client-side INSERT ... RETURNING: Postgres RLS applies the SELECT
-- policy to a RETURNING clause too, and the SELECT policy above requires
-- the caller to already be a household_members row for that household —
-- which doesn't exist yet at the moment of creation (chicken-and-egg,
-- causes "new row violates row-level security policy"). This function
-- does both inserts atomically as SECURITY DEFINER, bypassing RLS
-- internally, then returns the finished row.
create or replace function public.create_household(new_name text default null)
returns table (id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  insert into public.households (name, created_by)
  values (coalesce(new_name, 'My Household'), auth.uid())
  returning households.id into new_household_id;

  insert into public.household_members (household_id, user_id)
  values (new_household_id, auth.uid());

  return query select h.id, h.name, h.invite_code from public.households h where h.id = new_household_id;
end;
$$;

grant execute on function public.create_household(text) to authenticated;

-- Members can see who else is in their household(s).
drop policy if exists "Members can view household membership" on public.household_members;
create policy "Members can view household membership"
  on public.household_members
  for select
  using (household_id in (select public.my_household_ids()));

-- A user can add themselves as a member (used right after creating a household).
drop policy if exists "Users can add themselves as a member" on public.household_members;
create policy "Users can add themselves as a member"
  on public.household_members
  for insert
  with check (user_id = auth.uid());

-- A user can remove themselves (leave a household).
drop policy if exists "Users can remove themselves" on public.household_members;
create policy "Users can remove themselves"
  on public.household_members
  for delete
  using (user_id = auth.uid());

-- Joining by invite code is done via this function instead of a broad
-- SELECT policy on households, so a client can never browse/guess other
-- households' data — it can only join one it already has the exact code for.
create or replace function public.join_household_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household_id uuid;
begin
  select id into target_household_id from public.households where invite_code = code;
  if target_household_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.household_members (household_id, user_id)
  values (target_household_id, auth.uid())
  on conflict (household_id, user_id) do nothing;

  return target_household_id;
end;
$$;

grant execute on function public.join_household_by_code(text) to authenticated;

-- ────────────────────────────────────────────────────────────
-- 2. pantry_items — add household sharing (additive, backward compatible)
-- ────────────────────────────────────────────────────────────

alter table public.pantry_items add column if not exists household_id uuid references public.households(id) on delete set null;

-- Replaces the original single-owner policy with one that ALSO allows
-- access when a row's household_id matches a household the user belongs
-- to. Existing rows (household_id is null) are completely unaffected —
-- they still only match via the `auth.uid() = user_id` branch.
drop policy if exists "Users manage their own pantry" on public.pantry_items;
drop policy if exists "Users manage their own or household pantry" on public.pantry_items;
create policy "Users manage their own or household pantry"
  on public.pantry_items
  for all
  using (
    auth.uid() = user_id
    or household_id in (select public.my_household_ids())
  )
  with check (
    auth.uid() = user_id
    or household_id in (select public.my_household_ids())
  );

-- ────────────────────────────────────────────────────────────
-- 3. Shopping list (per-user; not shared via household in this version)
-- ────────────────────────────────────────────────────────────

create table if not exists public.shopping_list_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  source_recipe text,
  checked       boolean not null default false,
  created_at    timestamptz default now()
);

alter table public.shopping_list_items enable row level security;

drop policy if exists "Users manage their own shopping list" on public.shopping_list_items;
create policy "Users manage their own shopping list"
  on public.shopping_list_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- `alter publication ... add table` errors if the table is already a
-- member (no "if not exists" support), so guard it to keep this whole
-- file safely re-runnable.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_list_items'
  ) then
    alter publication supabase_realtime add table public.shopping_list_items;
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 4. Scan history (per-user; log of barcode/receipt/manual scans)
-- ────────────────────────────────────────────────────────────

create table if not exists public.scan_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  product_name text not null,
  source       text check (source in ('barcode', 'receipt', 'manual')) not null,
  health_score text,
  scanned_at   timestamptz default now()
);

alter table public.scan_history enable row level security;

drop policy if exists "Users manage their own scan history" on public.scan_history;
create policy "Users manage their own scan history"
  on public.scan_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 5. pantry_items — persist real ingredient text (additive)
-- ────────────────────────────────────────────────────────────
-- Previously the "Allergen Safe" badge was a hardcoded default shown for
-- every item regardless of contents — a fabricated safety claim, not a
-- placeholder. This column lets the app persist ingredient text fetched
-- from Open Food Facts at scan time so allergen presence can be checked
-- for real. No policy changes needed — it's covered by the existing
-- pantry_items policy, which isn't column-specific.

alter table public.pantry_items add column if not exists ingredients_text text;

-- ────────────────────────────────────────────────────────────
-- 6. Item outcomes (per-user; log of used-in-time vs. wasted, for the
--    impact dashboard's money/CO2/waste-rate estimates)
-- ────────────────────────────────────────────────────────────
-- Nothing previously recorded what happened to an item after it was
-- deleted — this table logs the outcome at delete time so it can be
-- aggregated later. "used" vs "expired" is inferred from whether
-- days_left was still positive at the moment of deletion — the same
-- heuristic the rest of the app already uses for risk/status display,
-- not a new fabrication.

create table if not exists public.item_outcomes (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete cascade not null,
  name                  text not null,
  category              text not null,
  outcome               text check (outcome in ('used', 'expired')) not null,
  days_left_at_removal  integer not null,
  removed_at            timestamptz default now()
);

alter table public.item_outcomes enable row level security;

drop policy if exists "Users manage their own item outcomes" on public.item_outcomes;
create policy "Users manage their own item outcomes"
  on public.item_outcomes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 7. Household waste-reduction leaderboard (read-only aggregate)
-- ────────────────────────────────────────────────────────────
-- item_outcomes' own RLS policy above is owner-only ("auth.uid() =
-- user_id"), which is correct for the raw rows — one member should not be
-- able to browse another member's individual scan/removal history. A
-- household leaderboard still needs *aggregate counts* across members, so
-- this is a SECURITY DEFINER function (same pattern as my_household_ids()
-- above) that computes the aggregate server-side and returns only
-- display_name + counts + streak — never raw item_outcomes rows — to
-- other members. Returns an empty set for a user with no household.

create or replace function public.household_impact_leaderboard()
returns table (
  user_id       uuid,
  display_name  text,
  items_used    bigint,
  items_expired bigint,
  streak_days   integer
)
language sql
security definer
set search_path = public
as $$
  with my_household as (
    select household_id from public.household_members where user_id = auth.uid() limit 1
  ),
  members as (
    select hm.user_id from public.household_members hm
    where hm.household_id in (select household_id from my_household)
  ),
  outcomes as (
    select
      io.user_id,
      count(*) filter (where io.outcome = 'used') as items_used,
      count(*) filter (where io.outcome = 'expired') as items_expired,
      max(io.removed_at) filter (where io.outcome = 'expired') as last_expired_at
    from public.item_outcomes io
    where io.user_id in (select user_id from members)
    group by io.user_id
  )
  select
    m.user_id,
    coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)) as display_name,
    coalesce(o.items_used, 0) as items_used,
    coalesce(o.items_expired, 0) as items_expired,
    case when o.last_expired_at is null then null
         else floor(extract(epoch from (now() - o.last_expired_at)) / 86400)::integer
    end as streak_days
  from members m
  left join outcomes o on o.user_id = m.user_id
  left join auth.users u on u.id = m.user_id;
$$;

grant execute on function public.household_impact_leaderboard() to authenticated;

-- ────────────────────────────────────────────────────────────
-- 8. pantry_items — persist the real NutriTrust score (additive)
-- ────────────────────────────────────────────────────────────
-- The item card used to render an A–E grade derived from the item name's
-- character count (name.length % 5), which meant Milk showed "E" and Bread
-- showed "A" for no reason at all. This column stores the genuine 1–5 score
-- that /api/analyze-food already computes at scan time, so the card can
-- show a real reading — and honestly show nothing for items that were never
-- scanned, rather than inventing one. No policy change needed: the existing
-- pantry_items policy is not column-specific.

alter table public.pantry_items add column if not exists health_score text;
