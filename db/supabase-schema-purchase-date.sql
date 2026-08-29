-- ============================================================
-- Nutri-Trust — purchase_date: text -> date
-- Run this in Supabase: SQL Editor > New Query
--
-- ON THE CURRENT PRODUCTION DATABASE THIS DOES NOTHING, AND THAT IS THE
-- EXPECTED RESULT. It prints a notice and exits.
--
-- The deployed column was checked directly and is already `date`. It was
-- probably converted by hand at some point, and the repo's SQL files were
-- never updated to match — supabase-schema.sql still declared it as text
-- until this change. The file is kept for any database created from that
-- older schema, and because the drift is worth recording rather than
-- quietly patching.
--
-- How it was determined, without access to information_schema: insert a
-- value the two types treat differently and read the result back.
--
--   'Aug 6, 2026'           -> stored as '2026-08-06'   (normalised)
--   'definitely not a date' -> rejected, "invalid input syntax for type date"
--
-- A text column would have stored both verbatim.
--
-- Run AFTER supabase-schema-hardening.sql.
-- ============================================================
--
-- WHY IT WOULD HAVE MATTERED
--
-- As text, the column collected three shapes depending on the code path:
--
--   'Aug 06, 2026'             -- the old column default, zero-padded day
--   'Aug 6, 2026'              -- toLocaleDateString('en-US'), NO padding
--   '2026-08-06T10:00:00.000Z' -- toISOString()
--
-- Three formats in one text column means ordering is alphabetical rather
-- than chronological, and no range query is possible. As `date`, Postgres
-- parses and normalises all three on the way in, so the problem cannot
-- recur. The application was separately changed to write ISO everywhere,
-- so it no longer depends on Postgres being lenient about locale strings.


do $$
declare
  unparsed integer;
  current_type text;
begin
  select data_type into current_type
    from information_schema.columns
   where table_schema = 'public' and table_name = 'pantry_items'
     and column_name = 'purchase_date';

  if current_type is distinct from 'text' then
    raise notice 'purchase_date is already %, not text — nothing to do.', coalesce(current_type, 'missing');
    return;
  end if;

  alter table public.pantry_items rename column purchase_date to purchase_date_text;
  alter table public.pantry_items add column purchase_date date;

  -- The day is \d{1,2}, NOT \d{2}. The old column default padded it
  -- ('Aug 06') but toLocaleDateString did not ('Aug 6'), and a
  -- two-digit-only pattern silently sends every unpadded row down the
  -- fallback branch — which looks like it worked while quietly replacing
  -- real purchase dates with row-creation dates.
  update public.pantry_items
    set purchase_date = coalesce(
      case
        when purchase_date_text ~ '^\d{4}-\d{2}-\d{2}'
          then purchase_date_text::date
        when purchase_date_text ~ '^[A-Za-z]{3} \d{1,2}, \d{4}$'
          then to_date(purchase_date_text, 'Mon DD, YYYY')
        else null
      end,
      created_at::date,
      current_date
    );

  select count(*) into unparsed
    from public.pantry_items
   where purchase_date_text is not null
     and purchase_date_text !~ '^\d{4}-\d{2}-\d{2}'
     and purchase_date_text !~ '^[A-Za-z]{3} \d{1,2}, \d{4}$';

  if unparsed > 0 then
    raise notice 'purchase_date: % row(s) had an unrecognised format and fell back to created_at.', unparsed;
  else
    raise notice 'purchase_date: every row parsed cleanly.';
  end if;

  alter table public.pantry_items alter column purchase_date set not null;
  alter table public.pantry_items alter column purchase_date set default current_date;
end $$;

-- Items are listed by expiry, which is derived from this column.
create index if not exists pantry_items_purchase_date_idx
  on public.pantry_items (purchase_date desc);

comment on column public.pantry_items.purchase_date is
  'When the item was bought. Read from the receipt where one was scanned, otherwise the day the row was created.';


-- ────────────────────────────────────────────────────────────
-- Verify
-- ────────────────────────────────────────────────────────────
--   select column_name, data_type from information_schema.columns
--    where table_schema = 'public' and table_name = 'pantry_items'
--      and column_name like 'purchase_date%';
--
-- Expect one row: purchase_date | date.

-- ────────────────────────────────────────────────────────────
-- Rollback (only if this file actually converted something)
-- ────────────────────────────────────────────────────────────
--   alter table public.pantry_items drop column purchase_date;
--   alter table public.pantry_items rename column purchase_date_text to purchase_date;
