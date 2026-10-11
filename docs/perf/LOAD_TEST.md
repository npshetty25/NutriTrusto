# Load test — synthetic benchmark

> **This is a synthetic benchmark, not a measurement of real users.** Simulated
> users run on the same laptop as the server, against a local production
> build, talking to a loopback stub in place of Supabase. It says how this
> application behaves on this machine under this traffic mix. It does not
> predict Vercel, Azure, or what a real person experiences over a mobile
> network.

## Setup

| | |
|---|---|
| App | `npm run build && next start -p 3100`, build `1fadccc`, Next.js 16.2.1, Node 22.18 |
| Dependency | `perf/stub_supabase.py`, a loopback HTTP server that answers 200 to everything |
| Load generator | Locust 2.46.7, one process, same machine |
| Hardware | Intel Core i5-12450H (8 cores / 12 threads), 15.7 GB RAM, Windows 11 |
| Date | 2026-10-11 |

Endpoints exercised, all unauthenticated and free of paid calls: `/api/health`
(readiness, one outbound request to the stub), `/api/health?probe=live`,
`/login`, `/manifest.webmanifest`, `/offline.html`. The Gemini-backed routes
were **not** tested: they need a signed-in token and each hit spends quota.

## Commands

```bash
# stand-in for Supabase, then the app built against it
python perf/stub_supabase.py &
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=load-test \
  GEMINI_API_KEY=load-test npm run build && npx next start -p 3100 &

# A. realistic pacing: 0.2–1.0 s think time
locust -f perf/locustfile.py --host http://localhost:3100 --headless \
  -u 50 -r 10 -t 60s --csv perf/results/run-50u

# B. saturation: no think time
LT_NO_WAIT=1 locust -f perf/locustfile.py --host http://localhost:3100 --headless \
  -u 100 -r 50 -t 45s --csv perf/results/run-100u-nowait
```

Raw output: `perf/results/*_stats.csv`.

## Results

### A. 50 users, think time 0.2–1.0 s, 60 s

| Endpoint | Requests | Failures | Median | p95 | p99 | req/s |
|---|---|---|---|---|---|---|
| `/api/health?probe=live` | 1,752 | 0 | 5 ms | 11 ms | 24 ms | 29.6 |
| `/api/health` | 998 | 0 | 9 ms | 19 ms | 40 ms | 16.8 |
| `/login` | 1,331 | 0 | 7 ms | 18 ms | 39 ms | 22.5 |
| `/manifest.webmanifest` | 323 | 0 | 5 ms | 11 ms | 17 ms | 5.4 |
| `/offline.html` | 330 | 0 | 6 ms | 19 ms | 28 ms | 5.6 |
| **All** | **4,734** | **0 (0.00%)** | **6 ms** | **16 ms** | **28 ms** | **79.9** |

This run is paced by the users' think time, so it shows latency at a modest
rate. It is not the ceiling.

### B. 100 users, no think time, 45 s

| Endpoint | Requests | Failures | Median | p95 | p99 | req/s |
|---|---|---|---|---|---|---|
| `/api/health` | 4,327 | 0 | 300 ms | 410 ms | 550 ms | 97.1 |
| `/login` | 5,827 | 0 | 240 ms | 350 ms | 540 ms | 130.7 |
| **All** | **20,510** | **0 (0.00%)** | **180 ms** | **480 ms** | **630 ms** | **460.2** |

## Reading these honestly

- **0 errors in 25,244 requests** across both runs.
- The saturation run's ~460 req/s is a floor on what this build can do on this
  laptop, not a ceiling: Locust runs as a single Python process on the same
  CPU, so the generator is itself a likely limit, and the server and generator
  compete for cores.
- Median latency rises from 6 ms to 180 ms when 100 users hammer without
  pausing; that is queueing on a saturated machine, not a per-request cost.
- `/login` is a statically prerendered page, so its numbers measure Next's
  static serving, not React rendering or database work.
- Nothing here exercises Supabase's real latency, row-level security, or
  Gemini. The readiness probe's cost is the loopback stub's, ~1 ms.
- The in-memory rate limiter (`src/lib/rate-limit.ts`) is per-instance and was
  not under test, because the routes it protects need authentication.
