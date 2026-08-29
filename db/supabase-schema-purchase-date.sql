-- ============================================================
-- Nutri-Trust — purchase_date: text -> timestamptz
-- Run this in Supabase: SQL Editor > New Query
--
-- DEFERRED ON PURPOSE. This is the only migration in the project that
-- changes the type of a column that already holds data. Run it when there
-- is time to check the app afterwards — not on the morning of a demo.
--
-- Run AFTER supabase-schema-hardening.sql.
-- ============================================================
--
-- WHY
--
-- purchase_date was declared:
--
--   purchase_date text not null default to_char(now(), 'Mon DD, YYYY')
--
-- so the column holds THREE different shapes depending on which code path
-- wrote the row:
--
--   'Aug 06, 2026'             -- the column default, zero-padded day
--   'Aug 6, 2026'              -- toLocaleDateString('en-US'), NO padding
--   '2026-08-06T10:00:00.000Z' -- toISOString(), from demo data and edits
--
-- Three formats in one text column means ordering is alphabetical rather
-- than chronological ('Apr' sorts before 'Jan'), and no range query is
-- possible. Every consumer has to re-parse the string and guess.
--
-- REVERSIBILITY
--
-- The original strings are kept verbatim in purchase_date_text. Nothing is
-- discarded, so this can be rolled back — see the bottom of this file.
--
-- BEFORE RUNNING, check what you are about to convert:
--
--   select purchase_date, count(*) from public.pantry_items
--    group by 1 order by 2 desc limit 20;


do $$
declare
  unparsed integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pantry_items'
      and column_name = 'purchase_date' and data_type = 'text'
  ) then
    raise notice 'purchase_date is already not text — nothing to do.';
    return;
  end if;

  alter table public.pantry_items rename column purchase_date to purchase_date_text;
  alter table public.pantry_items add column purchase_date timestamptz;

  -- The day is \d{1,2}, NOT \d{2}. The column default pads it ('Aug 06')
  -- but toLocaleDateString does not ('Aug 6'), and a two-digit-only pattern
  -- silently sends every unpadded row down the fallback branch — which
  -- looks like it worked and quietly replaces real purchase dates with
  -- row-creation dates.
  update public.pantry_items
    set purchase_date = coalesce(
      case
        when purchase_date_text ~ '^\d{4}-\d{2}-\d{2}'
          then purchase_date_text::timestamptz
        when purchase_date_text ~ '^[A-Za-z]{3} \d{1,2}, \d{4}$'
          then to_timestamp(purchase_date_text, 'Mon DD, YYYY')
        else null
      end,
      created_at,
      now()
    );

  -- Report anything that needed the fallback, so a silent mass-rewrite
  -- cannot pass unnoticed.
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
  alter table public.pantry_items alter column purchase_date set default now();
end $$;

-- Items are listed by expiry, which is derived from this column.
create index if not exists pantry_items_purchase_date_idx
  on public.pantry_items (purchase_date desc);

comment on column public.pantry_items.purchase_date is
  'When the item was bought, as a real timestamp. Read from the receipt where one was scanned, otherwise the time the row was created. Was text in three different formats before 2026-08.';

comment on column public.pantry_items.purchase_date_text is
  'The original pre-migration string, kept so the timestamptz conversion is reversible. Safe to drop once the app has been confirmed working.';


-- ────────────────────────────────────────────────────────────
-- Verify
-- ────────────────────────────────────────────────────────────
--   select column_name, data_type from information_schema.columns
--    where table_schema = 'public' and table_name = 'pantry_items'
--      and column_name like 'purchase_date%';
--
--   -- Any row where the conversion disagrees with the original string:
--   select id, purchase_date_text, purchase_date from public.pantry_items
--    where purchase_date_text is not null
--      and date_trunc('day', purchase_date) is distinct from
--          date_trunc('day', coalesce(
--            nullif(purchase_date_text, '')::timestamptz, purchase_date))
--    limit 20;

-- ────────────────────────────────────────────────────────────
-- Rollback
-- ────────────────────────────────────────────────────────────
--   alter table public.pantry_items drop column purchase_date;
--   alter table public.pantry_items rename column purchase_date_text to purchase_date;
