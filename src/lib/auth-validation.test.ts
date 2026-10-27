import { describe, expect, it } from "vitest";
import { friendlyAuthError, normaliseEmail, validateEmail, validateName, validateNewPassword } from "./auth-validation";

describe("validateEmail", () => {
  it.each(["asha@gmail.com", "Asha.Rao+pantry@learner.manipal.edu", "  ASHA@GMAIL.COM  "])("accepts %s", (e) => {
    expect(validateEmail(e)).toBeNull();
  });
  it.each(["", "   ", "asha", "asha@", "@gmail.com", "asha@gmail", "a@b.c", "asha rao@gmail.com", "asha@@gmail.com"])(
    "rejects %j",
    (e) => {
      expect(validateEmail(e)).not.toBeNull();
    }
  );
  it("normalises case and spaces", () => {
    expect(normaliseEmail("  Asha@Gmail.COM ")).toBe("asha@gmail.com");
  });
});

describe("validateName", () => {
  it.each(["Asha", "Asha Rao", "D'Souza", "Mary-Jane", "Dr. K. Rao", "नीरव", "அருண்"])("accepts %s", (n) => {
    expect(validateName(n)).toBeNull();
  });
  it.each(["", "  ", "A", "1234", "asha123", "<script>", "x".repeat(51), "@@@"])("rejects %j", (n) => {
    expect(validateName(n)).not.toBeNull();
  });
});

describe("validateNewPassword", () => {
  it.each(["secret12", "Pantry2026!", "a1b2c3d4"])("accepts %s", (p) => {
    expect(validateNewPassword(p)).toBeNull();
  });
  it.each([
    ["too short", "abc12"],
    ["letters only", "abcdefgh"],
    ["digits only", "12345678"],
    ["leading space", " abcd1234"],
    ["trailing space", "abcd1234 "],
  ])("rejects %s", (_l, p) => {
    expect(validateNewPassword(p)).not.toBeNull();
  });
});

describe("friendlyAuthError", () => {
  it("rewords the common Supabase messages", () => {
    expect(friendlyAuthError("Invalid login credentials")).toBe("Wrong email or password.");
    expect(friendlyAuthError("User already registered")).toMatch(/already exists/);
    expect(friendlyAuthError("Email not confirmed")).toMatch(/confirm your email/);
    expect(friendlyAuthError("Email rate limit exceeded")).toMatch(/Too many attempts/);
  });
  it("rewords the password-reset messages", () => {
    expect(friendlyAuthError("For security purposes, you can only request this after 37 seconds.")).toMatch(/wait a minute/);
    expect(friendlyAuthError("Email address not authorized")).toMatch(/couldn't send email/);
    expect(friendlyAuthError("New password should be different from the old password.")).toMatch(/haven't used/);
  });
  it("passes unknown messages through unchanged", () => {
    expect(friendlyAuthError("Something new")).toBe("Something new");
  });
});
