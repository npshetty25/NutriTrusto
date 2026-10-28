import { describe, expect, it } from "vitest";
import { keyToBytes } from "./push-client";

describe("keyToBytes", () => {
  it("decodes a URL-safe base64 public key to its bytes", () => {
    // 65 bytes is the length of an uncompressed P-256 key, which VAPID public keys are.
    const key = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
    const bytes = keyToBytes(key);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04);
  });

  it("handles keys that need padding and the URL-safe alphabet", () => {
    expect(Array.from(keyToBytes("-_8"))).toEqual([0xfb, 0xff]);
    expect(Array.from(keyToBytes("AQID"))).toEqual([1, 2, 3]);
  });
});
