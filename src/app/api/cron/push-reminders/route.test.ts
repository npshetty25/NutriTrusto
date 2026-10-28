import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { silenceLogs } from "@/test/route-helpers";

const createClient = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient }));
const setVapidDetails = vi.hoisted(() => vi.fn());
vi.mock("web-push", () => ({ default: { setVapidDetails, sendNotification: vi.fn() } }));

import { GET } from "./route";

const ENV = {
  CRON_SECRET: "s3cret-token",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  VAPID_PRIVATE_KEY: "private",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public",
  VAPID_SUBJECT: "mailto:owner@example.test",
};

const call = (token?: string) =>
  GET(new Request("http://localhost/api/cron/push-reminders", { headers: token ? { authorization: `Bearer ${token}` } : {} }));

beforeEach(() => {
  silenceLogs();
  createClient.mockReset();
  setVapidDetails.mockReset();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/push-reminders", () => {
  it("does nothing, and says why, until every value is configured", async () => {
    for (const key of Object.keys(ENV)) {
      vi.stubEnv(key, "");
      const res = await call(ENV.CRON_SECRET);
      expect(res.status, key).toBe(503);
      vi.stubEnv(key, ENV[key as keyof typeof ENV]);
    }
    expect(createClient).not.toHaveBeenCalled();
  });

  it("401 without the cron secret, and never opens the database", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("wrong-token")).status).toBe(401);
    expect((await call(ENV.CRON_SECRET + "x")).status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
    expect(setVapidDetails).not.toHaveBeenCalled();
  });

  it("503 names no secret value", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const text = JSON.stringify(await (await call(ENV.CRON_SECRET)).json());
    for (const v of Object.values(ENV)) expect(text).not.toContain(v);
  });
});
