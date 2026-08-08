# Nutri-Trust — Smart Pantry

A pantry tracker that helps reduce household food waste: scan groceries in,
see what's about to expire, and get a recipe to use it up before it spoils.

Live: https://nutri-trusto.vercel.app

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Used for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `GEMINI_API_KEY` | Receipt / label / expiry scanning and pantry chat |
| `OFF_USER_ID`, `OFF_PASSWORD` | *(optional)* contributing corrected barcodes back to Open Food Facts |

## Database setup

Run both files in the Supabase SQL Editor, in order:

1. `db/supabase-schema.sql` — base tables
2. `db/supabase-schema-additions.sql` — households, shopping list, scan
   history, ingredient text, item outcomes, household leaderboard

Both are idempotent and additive, so re-running them is safe. The app probes
for newer columns at startup and degrades gracefully with a "migration hasn't
been run" message rather than failing, so it stays usable if you've only run
the first file.

## Stack

- **Next.js 16** (App Router, Turbopack), React 19, TypeScript, Tailwind v4
- **Supabase** — Postgres, Auth, Realtime, row-level security
- **Google Gemini** (`gemini-2.5-flash`) — receipt OCR, nutrition-label and
  expiry-date reading, and chat over your live pantry
- **Open Food Facts** — barcode product lookup
- **TheMealDB** — recipe lookup, restricted to Indian dishes
- Installable as a PWA (web manifest + a small offline app-shell cache)

## Layout

```
smart-pantry/          this app
├── src/app/           routes, layout, and API routes
├── src/components/    UI components
├── src/context/       auth + household context
├── src/lib/           supabase client, allergens, categories, estimates
├── public/            static assets, service worker
└── db/                SQL migrations (run manually in Supabase)

project-files/         not part of the app
├── presentations/     slide decks and exported PDFs
├── reports/           written reports, judge Q&A
├── wireframe/         early wireframe
├── ppt-scripts/       one-off deck-generation scripts
└── archive/           extracted deck text, QA exports, superseded files
```

`FEATURE_IDEAS.md` tracks build status for planned and shipped features.
