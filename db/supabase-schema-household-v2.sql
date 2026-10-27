-- ============================================================
-- Nutri-Trust — households, finished
-- Applied to production by the owner on 2026-10-27 (SQL editor).
-- Run this in Supabase: SQL Editor > New Query > paste > Run.
-- Run it AFTER supabase-schema-household-guard.sql.
--
-- Safe to run more than once. Deletes nothing and changes no existing row
-- when it runs; rows change only when someone uses one of these features.
--
--   1. One household per person. Joining a second household used to
--      succeed, and the app then showed whichever came back first.
--   2. household_members_list()  — who is in my household, by name.
--   3. share_my_items_with_household() — put my private items in it.
--   4. leave_household()         — leave, taking my items with me.
--   5. remove_household_member() — the creator can remove someone.
--   6. new_household_invite_code() — the creator can replace a leaked code.
--   7. A shared shopping list for the household.
--
-- Until this has run, the app keeps working: it hides the member list, the
-- creator controls and the shared shopping list, and leaves through the
-- older path.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. One household per person
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

  return target_household_id;
end;
$$;

grant execute on function public.join_household_by_code(text) to authenticated;


-- ────────────────────────────────────────────────────────────
-- 2. Who is in my household
-- ────────────────────────────────────────────────────────────
-- Names come from auth.users, which members cannot read directly, so this
-- is SECURITY DEFINER like household_impact_leaderboard(). It returns only
-- a display name, never an email address.

create or replace function public.household_members_list()
returns table (user_id uuid, display_name text, joined_at timestamptz, is_creator boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.user_id,
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 'A member') as display_name,
    m.joined_at,
    (h.created_by = m.user_id) as is_creator
  from public.household_members m
  join public.households h on h.id = m.household_id
  left join auth.users u on u.id = m.user_id
  where m.household_id in (select public.my_household_ids())
  order by m.joined_at;
$$;

grant execute on function public.household_members_list() to authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. Share my private items with my household
-- ────────────────────────────────────────────────────────────
-- Items added before creating or joining a household have no household_id
-- and stay private — the reason a new member used to see an empty pantry.
-- Returns how many items were shared.

create or replace function public.share_my_items_with_household()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  n integer;
begin
  select m.household_id into hid from public.household_members m where m.user_id = auth.uid() limit 1;
  if hid is null then
    raise exception 'You are not in a household' using errcode = 'P0002';
  end if;

  update public.pantry_items set household_id = hid
  where user_id = auth.uid() and household_id is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.share_my_items_with_household() to authenticated;


-- ────────────────────────────────────────────────────────────
-- 4. Leave, taking my items with me
-- ────────────────────────────────────────────────────────────
-- Leaving used to delete only the membership row, so the leaver's items
-- stayed in the household's pantry. Now they go back to the leaver's own
-- private pantry, and so do their shopping-list items. If nobody is left,
-- the existing cleanup trigger deletes the household.

create or replace function public.leave_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  select m.household_id into hid from public.household_members m where m.user_id = auth.uid() limit 1;
  if hid is null then
    return;
  end if;

  update public.pantry_items set household_id = null
  where user_id = auth.uid() and household_id = hid;
  update public.shopping_list_items set household_id = null
  where user_id = auth.uid() and household_id = hid;

  delete from public.household_members where household_id = hid and user_id = auth.uid();
end;
$$;

grant execute on function public.leave_household() to authenticated;


-- ────────────────────────────────────────────────────────────
-- 5. The creator can remove a member
-- ────────────────────────────────────────────────────────────
-- Their items go back to their own private pantry, as if they had left.

create or replace function public.remove_household_member(member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  select h.id into hid from public.households h
  join public.household_members m on m.household_id = h.id and m.user_id = auth.uid()
  where h.created_by = auth.uid();
  if hid is null then
    raise exception 'Only the person who created the household can remove members' using errcode = '42501';
  end if;
  if member_id = auth.uid() then
    raise exception 'Use leave_household() to leave' using errcode = 'P0002';
  end if;

  update public.pantry_items set household_id = null where user_id = member_id and household_id = hid;
  update public.shopping_list_items set household_id = null where user_id = member_id and household_id = hid;
  delete from public.household_members where household_id = hid and user_id = member_id;
end;
$$;

grant execute on function public.remove_household_member(uuid) to authenticated;


-- ────────────────────────────────────────────────────────────
-- 6. The creator can replace the invite code
-- ────────────────────────────────────────────────────────────
-- The code is the only thing guarding the household. If it was shared too
-- widely, the old one stops working at once.

create or replace function public.new_household_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  fresh text;
begin
  select h.id into hid from public.households h
  join public.household_members m on m.household_id = h.id and m.user_id = auth.uid()
  where h.created_by = auth.uid();
  if hid is null then
    raise exception 'Only the person who created the household can change its code' using errcode = '42501';
  end if;

  fresh := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  update public.households set invite_code = fresh where id = hid;
  return fresh;
end;
$$;

grant execute on function public.new_household_invite_code() to authenticated;


-- ────────────────────────────────────────────────────────────
-- 7. A shared shopping list
-- ────────────────────────────────────────────────────────────
-- Same model as pantry_items: a row is yours, and is also visible to your
-- household when it carries the household's id. The same guard trigger
-- stops anyone writing into a household they are not in.

alter table public.shopping_list_items
  add column if not exists household_id uuid references public.households(id) on delete set null;

create index if not exists shopping_list_items_household_idx
  on public.shopping_list_items (household_id) where household_id is not null;

drop policy if exists "Users manage their own shopping list" on public.shopping_list_items;
drop policy if exists "Users manage their own or household shopping list" on public.shopping_list_items;
create policy "Users manage their own or household shopping list"
  on public.shopping_list_items
  for all
  using (
    auth.uid() = user_id
    or household_id in (select public.my_household_ids())
  )
  with check (
    auth.uid() = user_id
    or household_id in (select public.my_household_ids())
  );

drop trigger if exists shopping_list_items_household_guard on public.shopping_list_items;
create trigger shopping_list_items_household_guard
  before insert or update on public.shopping_list_items
  for each row execute function public.pantry_items_household_guard();

notify pgrst, 'reload schema';
