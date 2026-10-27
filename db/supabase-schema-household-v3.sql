-- ============================================================
-- Nutri-Trust — a household has ONE pantry
-- NOT YET APPLIED to production. Review it, then run it in Supabase:
-- SQL Editor > New Query > paste > Run.
-- Run it AFTER supabase-schema-household-v2.sql.
--
-- Safe to run more than once. Deletes no pantry or shopping-list row.
-- Section 4 DOES change existing rows (see there).
--
-- Living in the same house means sharing the pantry, so being in a household
-- no longer depends on anyone remembering to share:
--
--   1. Joining or creating a household moves everything you already own
--      (pantry and shopping list) into it.
--   2. Anything you add while you are in a household goes into it, whatever
--      the app sends.
--   3. share_my_items_with_household() is removed; nothing is private-by-default
--      any more, so there is nothing left to share by hand.
--   4. Backfill: people who are ALREADY in a household, and whose older items
--      are still private, have those items moved in now.
--
-- Leaving or being removed still takes your own items back (v2), so nobody's
-- food is stranded in a household they are no longer part of.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Joining or creating brings your items in
-- ────────────────────────────────────────────────────────────

create or replace function public.create_household(new_name text default null)
returns table (id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  if exists (select 1 from public.household_members m where m.user_id = auth.uid()) then
    raise exception 'You are already in a household' using errcode = 'P0002';
  end if;

  insert into public.households (name, created_by)
  values (coalesce(nullif(trim(new_name), ''), 'My Household'), auth.uid())
  returning households.id into new_household_id;

  insert into public.household_members (household_id, user_id)
  values (new_household_id, auth.uid());

  update public.pantry_items set household_id = new_household_id
  where user_id = auth.uid() and household_id is null;
  update public.shopping_list_items set household_id = new_household_id
  where user_id = auth.uid() and household_id is null;

  return query select h.id, h.name, h.invite_code from public.households h where h.id = new_household_id;
end;
$$;

grant execute on function public.create_household(text) to authenticated;

create or replace function public.join_household_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household_id uuid;
begin
  select h.id into target_household_id from public.households h where h.invite_code = trim(code);
  if target_household_id is null then
    raise exception 'Invalid invite code';
  end if;

  -- Joining the household you are already in stays a harmless no-op.
  if exists (
    select 1 from public.household_members m
    where m.user_id = auth.uid() and m.household_id <> target_household_id
  ) then
    raise exception 'You are already in a household' using errcode = 'P0002';
  end if;

  insert into public.household_members (household_id, user_id)
  values (target_household_id, auth.uid())
  on conflict (household_id, user_id) do nothing;

  update public.pantry_items set household_id = target_household_id
  where user_id = auth.uid() and household_id is null;
  update public.shopping_list_items set household_id = target_household_id
  where user_id = auth.uid() and household_id is null;

  return target_household_id;
end;
$$;

grant execute on function public.join_household_by_code(text) to authenticated;


-- ────────────────────────────────────────────────────────────
-- 2. New items go into the household automatically
-- ────────────────────────────────────────────────────────────
-- Only on INSERT, and only when the row is the caller's own and names no
-- household. An UPDATE that clears household_id (leaving, removal) is left
-- alone, and so is an explicit household id (the guard trigger validates it).

create or replace function public.household_auto_assign()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or new.household_id is not null or new.user_id is distinct from auth.uid() then
    return new;
  end if;

  select h into new.household_id from public.my_household_ids() h limit 1;
  return new;
end;
$$;

drop trigger if exists pantry_items_household_auto_assign on public.pantry_items;
create trigger pantry_items_household_auto_assign
  before insert on public.pantry_items
  for each row execute function public.household_auto_assign();

drop trigger if exists shopping_list_items_household_auto_assign on public.shopping_list_items;
create trigger shopping_list_items_household_auto_assign
  before insert on public.shopping_list_items
  for each row execute function public.household_auto_assign();


-- ────────────────────────────────────────────────────────────
-- 3. Nothing to share by hand any more
-- ────────────────────────────────────────────────────────────

drop function if exists public.share_my_items_with_household();


-- ────────────────────────────────────────────────────────────
-- 4. Backfill — CHANGES EXISTING ROWS
-- ────────────────────────────────────────────────────────────
-- Everyone already in a household whose older items are still private gets
-- those items moved into the household, so the pantry they see matches the
-- one their housemates see. Rows that already carry a household id are not
-- touched; nothing is deleted.

update public.pantry_items p
set household_id = m.household_id
from public.household_members m
where p.user_id = m.user_id and p.household_id is null;

update public.shopping_list_items s
set household_id = m.household_id
from public.household_members m
where s.user_id = m.user_id and s.household_id is null;

notify pgrst, 'reload schema';

-- Roll back with:
--   drop trigger if exists pantry_items_household_auto_assign on public.pantry_items;
--   drop trigger if exists shopping_list_items_household_auto_assign on public.shopping_list_items;
--   drop function if exists public.household_auto_assign();
-- (then re-run supabase-schema-household-v2.sql to restore the two functions
-- and share_my_items_with_household(). Items already moved stay in the
-- household unless their owners leave it.)
