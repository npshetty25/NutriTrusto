import { MongoClient, type Collection } from "mongodb";
import { createRequestContext } from "@/lib/server-logger";

/**
 * Raw OCR payload store (MongoDB). See docs/adr/0001-postgres-plus-mongodb.md
 * for why this lives beside Postgres rather than in it.
 *
 * The contract that matters:
 *
 *  - It is OPTIONAL. Without MONGODB_URI every call is a cheap no-op that
 *    reports `stored: false`. The app behaves exactly as before.
 *  - It NEVER throws and never blocks a scan. A slow or failing store costs the
 *    user at most WRITE_TIMEOUT_MS, then the scan proceeds.
 *  - The pantry itself stays in Postgres. Nothing here is read to render the
 *    pantry; this collection is an append-only record of what the model said.
 */

export type ScanKind = "receipt" | "nutrition-label" | "expiry-date";

export interface RawScanDoc {
  /** Shared identifier. Postgres rows that came from this scan carry the same id. */
  scanId: string;
  userId: string;
  kind: ScanKind;
  model: string;
  /** The model's response exactly as parsed, before any normalisation. */
  payload: unknown;
  /** How many normalised items were produced from it, for later comparison. */
  normalisedCount?: number;
}

const DB_NAME = "nutri_trust";
const COLLECTION = "raw_scans";
const WRITE_TIMEOUT_MS = 1500;

type Cached = { promise: Promise<MongoClient> | null };
const globalForMongo = globalThis as unknown as { __nutriTrustMongo?: Cached };
const cache: Cached = (globalForMongo.__nutriTrustMongo ??= { promise: null });

/**
 * One client per server instance, reused across invocations. Serverless
 * functions are frozen and thawed, and opening a connection per request would
 * exhaust Atlas's connection limit under any real traffic. Stored on
 * globalThis so hot-reload in dev does not leak a client per edit.
 */
function getClient(uri: string): Promise<MongoClient> {
  if (!cache.promise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: WRITE_TIMEOUT_MS,
      maxPoolSize: 5,
      appName: "nutri-trust",
    });
    cache.promise = client.connect().catch((err) => {
      cache.promise = null; // let the next call retry instead of caching a failure
      throw err;
    });
  }
  return cache.promise;
}

export const isScanStoreConfigured = () => Boolean(process.env.MONGODB_URI);

export async function recordRawScan(doc: RawScanDoc): Promise<{ stored: boolean; reason?: string }> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return { stored: false, reason: "not configured" };

  const log = createRequestContext("lib/scan-store");
  const write = async () => {
    const client = await getClient(uri);
    const col: Collection = client.db(DB_NAME).collection(COLLECTION);
    await col.insertOne({ ...doc, createdAt: new Date() });
  };

  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("write timed out")), WRITE_TIMEOUT_MS);
    });
    try {
      await Promise.race([write(), timeout]);
    } finally {
      clearTimeout(timer);
    }
    return { stored: true };
  } catch (e) {
    // The scan already succeeded. Say what happened and carry on.
    log.warn("Raw scan was not stored", { scanId: doc.scanId, error: e instanceof Error ? e.message : String(e) });
    return { stored: false, reason: e instanceof Error ? e.message : "unknown" };
  }
}
