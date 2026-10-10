import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { silenceLogs, TEST_USER } from "@/test/route-helpers";

const getRequestUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  getRequestUser,
}));

import { GET } from "./route";

const fetchMock = vi.fn();
let userSeq = 0;

beforeEach(() => {
  silenceLogs();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  getRequestUser.mockReset();
  getRequestUser.mockResolvedValue(TEST_USER(`upc-user-${++userSeq}`));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const lookup = async (upc?: string) => {
  const url = upc === undefined ? "http://localhost/api/lookup-upc" : `http://localhost/api/lookup-upc?upc=${upc}`;
  const res = await GET(new Request(url));
  return { res, body: (await res.json()) as Record<string, unknown> };
};
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const notFound = { ok: false, status: 404, json: async () => ({}) };
const off = (product: Record<string, unknown> | null) => ok(product ? { status: 1, product } : { status: 0 });
const urls = () => fetchMock.mock.calls.map((c) => String(c[0]));

describe("GET /api/lookup-upc — source order", () => {
  it("returns the UPCItemDB answer as-is and stops there", async () => {
    const payload = { items: [{ title: "Parle-G", brand: "Parle" }] };
    fetchMock.mockResolvedValueOnce(ok(payload));
    const { res, body } = await lookup("8901719101200");
    expect(res.status).toBe(200);
    expect(body).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(urls()[0]).toContain("api.upcitemdb.com");
  });

  it("falls back to India Open Food Facts and reshapes the product", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ items: [] }))
      .mockResolvedValueOnce(off({ product_name: "Maggi Masala", brands: " Nestle , Maggi", quantity: "70 g", categories: "Noodles" }));
    const { body } = await lookup("8901058000290");
    expect(body).toEqual({ items: [{ title: "Maggi Masala", brand: "Nestle", size: "70 g", category: "Noodles" }] });
    expect(urls()[1]).toContain("in.openfoodfacts.org");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("then to the global server, trying alternative name fields in order", async () => {
    fetchMock
      .mockResolvedValueOnce(notFound)
      .mockResolvedValueOnce(off(null))
      .mockResolvedValueOnce(off({ product_name_en: "Digestive Biscuits", brand_owner: "Britannia" }));
    const { body } = await lookup("8901063010116");
    expect(body).toEqual({ items: [{ title: "Digestive Biscuits", brand: "Britannia", size: "", category: "" }] });
    expect(urls()[2]).toContain("world.openfoodfacts.org");
  });

  it("skips a product that has no usable name and keeps looking", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ items: [] }))
      .mockResolvedValueOnce(off({ quantity: "1 kg" })) // a record with no name at all
      .mockResolvedValueOnce(off({ generic_name: "Whole wheat flour" }));
    const { body } = await lookup("8901");
    expect((body.items as Array<{ title: string }>)[0].title).toBe("Whole wheat flour");
  });

  it("returns an empty list, not an error, when nothing knows the code", async () => {
    fetchMock.mockResolvedValueOnce(ok({ items: [] })).mockResolvedValueOnce(off(null)).mockResolvedValueOnce(off(null));
    const { res, body } = await lookup("0000000000000");
    expect(res.status).toBe(200);
    expect(body).toEqual({ items: [] });
  });

  it("treats a network failure at one source as 'no answer' and carries on", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(off({ product_name: "Amul Butter" }));
    const { res, body } = await lookup("8901262010023");
    expect(res.status).toBe(200);
    expect((body.items as Array<{ title: string }>)[0].title).toBe("Amul Butter");
  });

  it("returns an empty list when every source is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { res, body } = await lookup("8901262010023");
    expect(res.status).toBe(200);
    expect(body).toEqual({ items: [] });
  });
});

describe("GET /api/lookup-upc — input handling", () => {
  it("400 when no code is given, without contacting any upstream", async () => {
    const { res, body } = await lookup();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "No UPC provided" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("encodes the code so it cannot add a parameter or climb the path", async () => {
    fetchMock.mockResolvedValue(off(null));
    await lookup(encodeURIComponent("1234&evil=1"));
    await lookup(encodeURIComponent("../../admin"));

    for (const u of urls()) {
      expect(u).not.toMatch(/[?&]evil=/);
      expect(u).not.toContain("../");
    }
    expect(urls()[0]).toContain("upc=1234%26evil%3D1");
  });

  it("leaves a normal numeric code untouched", async () => {
    fetchMock.mockResolvedValueOnce(ok({ items: [{ title: "x" }] }));
    await lookup("8901719101200");
    expect(urls()[0]).toBe("https://api.upcitemdb.com/prod/trial/lookup?upc=8901719101200");
  });
});

describe("GET /api/lookup-upc — gatekeeping", () => {
  it("401 without a signed-in user, with no upstream traffic", async () => {
    getRequestUser.mockResolvedValue(null);
    const { res } = await lookup("8901719101200");
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("429 after 40 lookups a minute from one account", async () => {
    getRequestUser.mockResolvedValue(TEST_USER("upc-burst"));
    fetchMock.mockResolvedValue(ok({ items: [{ title: "x" }] }));
    for (let i = 0; i < 40; i++) expect((await lookup("8901719101200")).res.status).toBe(200);
    expect((await lookup("8901719101200")).res.status).toBe(429);
  });
});
