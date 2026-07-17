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
