-- ============================================================
-- Nutri-Trust — reminders while the app is closed (Web Push)
-- NOT YET APPLIED to production.
-- Run this in Supabase: SQL Editor > New Query > paste > Run.
--
-- One new table. Safe to run more than once, deletes nothing and changes no
-- existing row.
--
--   push_subscriptions  one row per browser a person has allowed reminders
--                       on. endpoint / p256dh / auth are what the browser's
--                       push service gave us; they let us send that one
--                       browser a message, and nothing else.
--
-- Each person can see, add and remove only their own rows. The daily job
-- that sends the reminders reads every row with the service role key, which
-- is kept in Vercel's environment and never in this repository.
--
-- Until this has run, the app does not offer the reminder switch.
-- ============================================================

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  endpoint    text not null unique check (char_length(endpoint) <= 2000),
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  -- The day (UTC) a reminder last went to this browser, so a retried job cannot send twice.
  last_sent_on date,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users manage their own push subscriptions" on public.push_subscriptions;
create policy "Users manage their own push subscriptions"
  on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';

-- Roll back with:
--   drop table if exists public.push_subscriptions;
