-- ============================================================
-- Applied to production by the owner on 2026-10-19 (SQL editor).
-- Run this AFTER supabase-schema-hardening.sql.
--
-- Problem (reproduced in db/rls.test.ts against the real migrations):
--   The pantry_items policy's WITH CHECK is
--       auth.uid() = user_id  OR  household_id in (my_household_ids())
--   so the first branch accepts ANY household_id as long as the row is the
--   caller's own. A signed-in user who is not a member of a household can
--     * INSERT a row with that household's id, and
--     * UPDATE their own row to move it into that household,
--   and the row then appears in every member's pantry. A user who has LEFT a
--   household keeps its UUID, so they keep that write access indefinitely.
--   Reading is not affected: they still cannot see the household's rows.
--
-- Why a trigger and not a tighter policy:
--   A policy cannot see OLD. Tightening WITH CHECK to "household_id must be
--   one of mine" would also block a former member from editing their own
--   historical rows (whose household_id they no longer belong to). A trigger
--   can validate only when household_id is being set or changed.
--
-- Safe to re-run. Does not touch any existing row, policy or function.
-- ============================================================

create or replace function public.pantry_items_household_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No JWT subject means the SQL editor or the service role, not an end user.
  if auth.uid() is null then
    return new;
  end if;

  if new.household_id is not null
     and (tg_op = 'INSERT' or new.household_id is distinct from old.household_id)
     and new.household_id not in (select public.my_household_ids())
  then
    raise exception 'You are not a member of that household'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists pantry_items_household_guard on public.pantry_items;
create trigger pantry_items_household_guard
  before insert or update on public.pantry_items
  for each row execute function public.pantry_items_household_guard();

-- Roll back with:
--   drop trigger if exists pantry_items_household_guard on public.pantry_items;
--   drop function if exists public.pantry_items_household_guard();
