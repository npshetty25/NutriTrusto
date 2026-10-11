# ADR 0001 — Keep PostgreSQL as the system of record; store raw OCR responses in MongoDB

- **Status:** Proposed. The implementation (an optional, fail-open store)
  exists on branch `feat/p4-mongodb` and is **not merged**; the Postgres link
  column is a proposed migration, not applied. Both wait on an Atlas cluster
  that only the project owner can create.
- **Date:** 2026-10-11
- **Deciders:** project owner

## Context

Three routes call Gemini and parse its JSON: receipts (`/api/extract`),
nutrition labels (`/api/scan-nutrition-label`) and expiry dates
(`/api/scan-expiry-date`). Each normalises the answer immediately (clamp days,
map risk, drop nameless rows) and returns only the normalised result. The
original response is discarded.

That loses three things we would like to have:

1. **Debuggability.** When a user reports "it read my receipt wrong", the model's
   original answer no longer exists, so nobody can tell a model error from a
   normalisation bug.
2. **A test corpus.** Real model outputs are the right inputs for regression
   tests of the normalisers; we currently invent them by hand.
3. **A basis for the category model** (ml/README.md): raw receipt lines are the
   distribution the classifier should eventually be evaluated on.

The shape of that data is the awkward part. The three routes return
different structures, each has optional and occasionally surprising fields
(the recipe route already accepts `toBuy` rows as either strings or objects
because its output changed shape once), and a model or prompt change can alter
it again without notice.

The rest of the system is the opposite: pantry items, households, membership,
shopping lists and outcomes are relational, are protected by row-level security,
and depend on transactional behaviour (`create_household` inserts a household
and its first member atomically; `join_household_by_code` is idempotent).

## Decision

- **PostgreSQL stays the system of record**, exactly as now: schema, RLS
  policies, security-definer functions and the 42P17 fix are untouched.
- **Raw OCR responses go to MongoDB**, one document per scan, in
  `nutri_trust.raw_scans`, as an append-only log.
- The two are linked by a **`scan_id`** (UUID) generated in the API route,
  stored on the Mongo document and returned to the client, which can persist it
  on the Postgres rows the scan produced.
- The store is **optional and fail-open**: without `MONGODB_URI` it does
  nothing, and a failure or timeout (1.5 s) never fails or visibly slows a scan.
- The client is **cached on `globalThis`** and pooled (max 5) so serverless
  invocations reuse a connection instead of opening one per request.

## Alternatives considered

| Option | Why not |
|---|---|
| **A `jsonb` column in Postgres** | Technically sufficient, and the simplest. It is the right answer if the only goal is to keep the payload. It is not chosen here because (a) the owner's goal for this project includes working with a document store, (b) it would mean raw model output living in tables with RLS and migrations, and (c) unbounded append-only blobs would grow the transactional database. Worth revisiting honestly if the Mongo side proves not worth its operational cost. |
| **Replace Postgres with MongoDB** | Loses RLS and the household guarantees, which are the project's core and were hard-won. Rejected outright. |
| **Object storage (S3/Blob) of JSON files** | Cheap and durable, but nothing can be queried without a pipeline. Fine for archival, wrong for "show me every receipt where the date was null". |
| **Log to stdout only** | Logs rotate and are not queryable by scan. Useful for operations, not for this. |
| **Do nothing** | Leaves the three problems above. |

## Consequences

**Good**
- Model output is preserved verbatim; normaliser bugs and model errors can be
  told apart after the fact.
- A growing, realistic corpus for tests and for evaluating the classifier.
- Schema changes in the model's output need no migration.

**Costs and risks**
- **A second datastore to run, secure and pay attention to.** On Atlas's free
  tier that is nominal money but not nominal attention.
- **No transaction spans both stores.** A scan can be recorded in Mongo and then
  fail to write Postgres rows, or the reverse. The log is therefore
  best-effort evidence, never a source of truth; nothing reads it to render the
  pantry.
- **Privacy.** Receipts can contain store names and purchase patterns. The
  privacy policy must say raw model responses are retained, for how long, and how
  to request deletion, **before** `MONGODB_URI` is set in production. A TTL
  index (proposed: 90 days) bounds retention.
- **Per-user access** is not enforced by a database policy here as it is in
  Postgres. Documents carry `userId`; any code that reads them must scope by it.
  Nothing reads them yet.
- **Operational:** the Atlas free tier pauses idle clusters, which the fail-open
  design absorbs but means gaps in the log.

## Follow-ups (not done)

1. Owner creates an Atlas cluster and supplies `MONGODB_URI` (secret).
2. Review and apply `db/proposed/scan-id-link.sql` to add `scan_id` to
   `pantry_items` and `scan_history`.
3. Client sends `scan_id` back with inserted rows.
4. Create the TTL index and update the privacy policy.
5. Decide whether the Mongo side earns its keep after a month of use.
