-- ============================================================
-- Nutri-Trust — per-item storage, opened state, and where the date came from
-- Run this in Supabase: SQL Editor > New Query > paste > Run.
--
-- Safe to run more than once (every statement is IF NOT EXISTS / guarded),
-- adds columns only, deletes nothing, and needs no new RLS policy: these are
-- ordinary columns on pantry_items, covered by the row policies that table
-- already has.
--
-- Until this has run, the app hides the storage / opened controls and keeps
-- working exactly as before — it probes for these columns at sign-in (see
-- trackingSchemaReady in src/context/auth-context.tsx).
-- ============================================================

alter table public.pantry_items
  -- Where the item is actually kept. NULL means "not told", and the app falls
  -- back to the storage its shelf-life table assumes for that item.
  add column if not exists storage text,
  -- When the pack was opened. NULL means unopened (or not told).
  add column if not exists opened_at timestamptz,
  -- Where the current days_left came from:
  --   'printed'  a date read off the pack (scan or barcode) — always wins
  --   'user'     typed in by the person
  --   NULL       the app's own estimate
  add column if not exists expiry_source text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pantry_items_storage_check') then
    alter table public.pantry_items
      add constraint pantry_items_storage_check
      check (storage is null or storage in ('fridge', 'counter', 'freezer'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pantry_items_expiry_source_check') then
    alter table public.pantry_items
      add constraint pantry_items_expiry_source_check
      check (expiry_source is null or expiry_source in ('printed', 'user'));
  end if;
end $$;

-- Make PostgREST see the new columns straight away rather than after its
-- schema cache next refreshes.
notify pgrst, 'reload schema';
