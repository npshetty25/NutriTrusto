-- ============================================================
-- PROPOSED — NOT APPLIED. Review before running against production.
--
-- Links Postgres rows to the raw OCR response stored in MongoDB
-- (docs/adr/0001-postgres-plus-mongodb.md) by a shared scan_id.
--
-- Additive and nullable: existing rows are untouched, the app keeps working if
-- nothing ever writes the column, and no policy changes are needed because the
-- existing policies are not column-specific.
-- ============================================================

alter table public.pantry_items add column if not exists scan_id uuid;
alter table public.scan_history add column if not exists scan_id uuid;

-- Only rows that came from a scan are indexed; most rows will be null.
create index if not exists pantry_items_scan_id_idx
  on public.pantry_items (scan_id) where scan_id is not null;
create index if not exists scan_history_scan_id_idx
  on public.scan_history (scan_id) where scan_id is not null;

comment on column public.pantry_items.scan_id is
  'UUID of the OCR scan this row was created from. Matches raw_scans.scanId in MongoDB. NULL for manually added items.';

-- Roll back with:
--   drop index if exists public.pantry_items_scan_id_idx;
--   drop index if exists public.scan_history_scan_id_idx;
--   alter table public.pantry_items drop column if exists scan_id;
--   alter table public.scan_history drop column if exists scan_id;
