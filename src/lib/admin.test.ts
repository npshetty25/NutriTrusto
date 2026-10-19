import { describe, expect, it } from "vitest";
import { isAdminEmail } from "./admin";

describe("isAdminEmail", () => {
  it("matches the exact email in a single-value list", () => {
    expect(isAdminEmail("nirav2005@gmail.com", "nirav2005@gmail.com")).toBe(true);
  });

  it("is case-insensitive and trims whitespace on both sides", () => {
    expect(isAdminEmail("  Nirav2005@Gmail.com ", "nirav2005@gmail.com")).toBe(true);
    expect(isAdminEmail("nirav2005@gmail.com", " NIRAV2005@GMAIL.COM ")).toBe(true);
  });

  it("matches any entry in a comma-separated list", () => {
    const list = "nirav2005@gmail.com, teammate@example.com,third@example.com";
    expect(isAdminEmail("teammate@example.com", list)).toBe(true);
    expect(isAdminEmail("third@example.com", list)).toBe(true);
  });

  it("rejects an email not in the list", () => {
    expect(isAdminEmail("stranger@example.com", "nirav2005@gmail.com")).toBe(false);
  });

  it("rejects everyone when the env var is unset or blank", () => {
    expect(isAdminEmail("nirav2005@gmail.com", undefined)).toBe(false);
    expect(isAdminEmail("nirav2005@gmail.com", "")).toBe(false);
    expect(isAdminEmail("nirav2005@gmail.com", "   ")).toBe(false);
  });

  it("rejects a missing or blank user email even with admins configured", () => {
    expect(isAdminEmail(null, "nirav2005@gmail.com")).toBe(false);
    expect(isAdminEmail(undefined, "nirav2005@gmail.com")).toBe(false);
    expect(isAdminEmail("  ", "nirav2005@gmail.com")).toBe(false);
  });

  it("does not match a prefix or substring of a listed email", () => {
    expect(isAdminEmail("nirav2005@gmail.com.evil.test", "nirav2005@gmail.com")).toBe(false);
    expect(isAdminEmail("nirav2005@gmail.co", "nirav2005@gmail.com")).toBe(false);
  });

  it("ignores stray empty entries from trailing commas", () => {
    expect(isAdminEmail("nirav2005@gmail.com", "nirav2005@gmail.com,,  ,")).toBe(true);
  });
});
