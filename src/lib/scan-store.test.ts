import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const insertOne = vi.hoisted(() => vi.fn());
const connect = vi.hoisted(() => vi.fn());
const constructed = vi.hoisted(() => vi.fn());
const dbName = vi.hoisted(() => vi.fn());
const collectionName = vi.hoisted(() => vi.fn());

vi.mock("mongodb", () => ({
  MongoClient: class {
    constructor(...args: unknown[]) {
      constructed(...args);
    }
    connect() {
      return connect().then(() => this);
    }
    db(name: string) {
      dbName(name);
      return {
        collection: (c: string) => {
          collectionName(c);
          return { insertOne };
        },
      };
    }
  },
}));

const doc = { scanId: "scan-1", userId: "u-1", kind: "receipt" as const, model: "gemini-2.5-flash", payload: { items: [{ name: "Milk" }] }, normalisedCount: 1 };

async function load() {
  vi.resetModules();
  delete (globalThis as { __nutriTrustMongo?: unknown }).__nutriTrustMongo;
  return import("./scan-store");
}

beforeEach(() => {
  insertOne.mockReset().mockResolvedValue({ acknowledged: true });
  connect.mockReset().mockResolvedValue(undefined);
  constructed.mockReset();
  dbName.mockReset();
  collectionName.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("recordRawScan — not configured", () => {
  it("is a no-op that never builds a client", async () => {
    vi.stubEnv("MONGODB_URI", "");
    const { recordRawScan, isScanStoreConfigured } = await load();
    expect(isScanStoreConfigured()).toBe(false);
    expect(await recordRawScan(doc)).toEqual({ stored: false, reason: "not configured" });
    expect(constructed).not.toHaveBeenCalled();
  });
});

describe("recordRawScan — configured", () => {
  beforeEach(() => vi.stubEnv("MONGODB_URI", "mongodb://stub.test/"));

  it("inserts the document with a timestamp into nutri_trust.raw_scans", async () => {
    const { recordRawScan } = await load();
    expect(await recordRawScan(doc)).toEqual({ stored: true });

    expect(dbName).toHaveBeenCalledWith("nutri_trust");
    expect(collectionName).toHaveBeenCalledWith("raw_scans");
    const inserted = insertOne.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted).toMatchObject(doc);
    expect(inserted.createdAt).toBeInstanceOf(Date);
  });

  it("keeps the model's payload exactly as given", async () => {
    const { recordRawScan } = await load();
    const odd = { items: [{ name: "x", extraField: { nested: [1, 2] } }], purchase_date_iso: null };
    await recordRawScan({ ...doc, payload: odd });
    expect((insertOne.mock.calls[0][0] as { payload: unknown }).payload).toEqual(odd);
  });

  it("reuses one client across calls (serverless-safe)", async () => {
    const { recordRawScan } = await load();
    await recordRawScan(doc);
    await recordRawScan({ ...doc, scanId: "scan-2" });
    await recordRawScan({ ...doc, scanId: "scan-3" });
    expect(constructed).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(insertOne).toHaveBeenCalledTimes(3);
  });

  it("configures a small pool and a short server-selection timeout", async () => {
    const { recordRawScan } = await load();
    await recordRawScan(doc);
    const [uri, options] = constructed.mock.calls[0] as [string, { maxPoolSize: number; serverSelectionTimeoutMS: number }];
    expect(uri).toBe("mongodb://stub.test/");
    expect(options.maxPoolSize).toBeLessThanOrEqual(10);
    expect(options.serverSelectionTimeoutMS).toBeLessThanOrEqual(3000);
  });

  it("never throws when the insert fails, and says why", async () => {
    insertOne.mockRejectedValue(new Error("not primary"));
    const { recordRawScan } = await load();
    expect(await recordRawScan(doc)).toEqual({ stored: false, reason: "not primary" });
  });

  it("does not cache a failed connection: the next call retries", async () => {
    connect.mockRejectedValueOnce(new Error("ECONNREFUSED")).mockResolvedValue(undefined);
    const { recordRawScan } = await load();
    expect((await recordRawScan(doc)).stored).toBe(false);
    expect((await recordRawScan(doc)).stored).toBe(true);
    expect(constructed).toHaveBeenCalledTimes(2);
  });

  it("gives up after the write timeout instead of holding up the scan", async () => {
    vi.useFakeTimers();
    insertOne.mockImplementation(() => new Promise(() => {})); // never settles
    const { recordRawScan } = await load();
    const pending = recordRawScan(doc);
    await vi.advanceTimersByTimeAsync(1600);
    expect(await pending).toEqual({ stored: false, reason: "write timed out" });
  });
});
