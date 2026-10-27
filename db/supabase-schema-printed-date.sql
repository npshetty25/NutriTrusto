-- ============================================================
-- Nutri-Trust — keep the date printed on the pack
-- NOT YET APPLIED to production.
-- Run this in Supabase: SQL Editor > New Query > paste > Run.
--
-- Adds one column to pantry_items, with a range check. Safe to run more than
-- once, deletes nothing, and changes no existing data.
--
--   pantry_items.expiry_date  the last good day printed on the pack, or typed
--                             by the person, as a calendar date. NULL means
--                             the item's date is our own estimate.
--
-- Why: days_left holds an item's life counted from purchase_date, and the
-- hardening file limits it to 0..3650. A pack whose printed date had already
-- passed when it was scanned could only be stored as 0, so its card showed
-- TODAY as the pack's date. With the date itself kept, the app counts from
-- it: "Best before 30 Sep, 28 days ago". days_left is still written, so
-- anything reading only days_left keeps working.
--
-- Until this has run, the app works exactly as before: it checks for the
-- column and only writes it once it exists.
-- ============================================================

alter table public.pantry_items
  add column if not exists expiry_date date;

-- NOT VALID: enforced on every insert and update from now on, without
-- scanning existing rows (all of which are NULL anyway).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pantry_items_expiry_date_range') then
    alter table public.pantry_items
      add constraint pantry_items_expiry_date_range
      check (expiry_date is null or expiry_date between date '2000-01-01' and date '2100-12-31') not valid;
  end if;
end $$;

comment on column public.pantry_items.expiry_date is
  'Last good day printed on the pack or typed by the person. When set, days left are counted from it; NULL means the date is our estimate (days_left counted from purchase_date).';

notify pgrst, 'reload schema';

-- Roll back with:
--   alter table public.pantry_items drop constraint if exists pantry_items_expiry_date_range;
--   alter table public.pantry_items drop column if exists expiry_date;
