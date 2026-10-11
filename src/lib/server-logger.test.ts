import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequestContext } from "./server-logger";

type Spy = ReturnType<typeof vi.spyOn>;
const lines = (spy: Spy) => spy.mock.calls.map((c) => JSON.parse(String(c[0])));

describe("createRequestContext", () => {
  let info: Spy;
  let warn: Spy;
  let error: Spy;

  beforeEach(() => {
    info = vi.spyOn(console, "info").mockImplementation(() => {});
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("writes one parseable JSON object per call with the reserved fields", () => {
    const log = createRequestContext("api/extract");
    log.info("Request received");
    const [entry] = lines(info);
    expect(entry).toMatchObject({ level: "info", route: "api/extract", msg: "Request received" });
    expect(entry.requestId).toBe(log.requestId);
    expect(new Date(entry.ts).toString()).not.toBe("Invalid Date");
    expect(typeof entry.durationMs).toBe("number");
    expect(entry.meta).toBeUndefined();
  });

  it("routes each level to the matching console method", () => {
    const log = createRequestContext("r");
    log.info("i");
    log.warn("w");
    log.error("e");
    expect(lines(info)[0].level).toBe("info");
    expect(lines(warn)[0].level).toBe("warn");
    expect(lines(error)[0].level).toBe("error");
  });

  it("nests metadata so it can never overwrite a reserved field", () => {
    const log = createRequestContext("r");
    log.info("hello", { level: "fatal", route: "spoof", requestId: "x" });
    const [entry] = lines(info);
    expect(entry.level).toBe("info");
    expect(entry.route).toBe("r");
    expect(entry.meta).toEqual({ level: "fatal", route: "spoof", requestId: "x" });
  });

  it("keeps the line when metadata cannot be serialised", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    createRequestContext("r").warn("loop", circular);
    const [entry] = lines(warn);
    expect(entry.msg).toBe("loop");
    expect(entry.meta).toBe("[unserializable]");
  });

  it("gives each context its own request id", () => {
    expect(createRequestContext("r").requestId).not.toBe(createRequestContext("r").requestId);
  });
});
