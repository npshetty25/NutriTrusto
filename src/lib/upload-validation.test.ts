import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, validateUpload } from "@/lib/upload-validation";

const file = (head: number[], { size = 64, name = "x.bin", type = "application/octet-stream" } = {}) => {
  const bytes = new Uint8Array(Math.max(size, head.length));
  bytes.set(head, 0);
  return new File([bytes], name, { type });
};

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

// Magic numbers for each accepted type. RIFF....WEBP and ....ftyp<brand>
// carry four unspecified bytes in the middle, filled with zeros here.
const SAMPLES: Array<[string, number[]]> = [
  ["image/jpeg", [0xff, 0xd8, 0xff, 0xe0]],
  ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ["application/pdf", ascii("%PDF-1.7")],
  ["image/webp", [...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")]],
  ["image/heic", [0, 0, 0, 0x18, ...ascii("ftyphevc")]],
  ["image/heic", [0, 0, 0, 0x18, ...ascii("ftypmif1")]],
];

describe("validateUpload — accepts by content", () => {
  it.each(SAMPLES)("recognises %s from its bytes", async (mime, head) => {
    // The claimed type is deliberately wrong: it must not matter.
    const result = await validateUpload(file(head, { name: "photo.txt", type: "text/plain" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mime).toBe(mime);
  });

  it("accepts a file of exactly the size limit", async () => {
    const result = await validateUpload(file([0xff, 0xd8, 0xff], { size: MAX_UPLOAD_BYTES }));
    expect(result.ok).toBe(true);
  });
});

describe("validateUpload — rejects", () => {
  const bodyOf = async (r: Awaited<ReturnType<typeof validateUpload>>) => {
    if (r.ok) throw new Error("expected a rejection");
    return { status: r.response.status, body: (await r.response.json()) as { success: boolean; error: string } };
  };

  it("a missing file with 400", async () => {
    const { status, body } = await bodyOf(await validateUpload(null));
    expect(status).toBe(400);
    expect(body).toEqual({ success: false, error: "No image provided" });
  });

  it("an empty file with 400", async () => {
    const empty = new File([], "empty.jpg", { type: "image/jpeg" });
    const { status } = await bodyOf(await validateUpload(empty));
    expect(status).toBe(400);
  });

  it("anything over the limit with 413 and the size in the message", async () => {
    const { status, body } = await bodyOf(
      await validateUpload(file([0xff, 0xd8, 0xff], { size: MAX_UPLOAD_BYTES + 1 }))
    );
    expect(status).toBe(413);
    expect(body.error).toMatch(/10\.0 MB.*under 10 MB/);
  });

  it.each([
    ["a zip", [0x50, 0x4b, 0x03, 0x04]],
    ["a Windows executable", [0x4d, 0x5a, 0x90, 0x00]],
    ["plain text", ascii("hello world")],
    ["a GIF", ascii("GIF89a")],
  ])("%s with 415, even when it claims to be a JPEG", async (_label, head) => {
    const { status } = await bodyOf(await validateUpload(file(head, { name: "receipt.jpg", type: "image/jpeg" })));
    expect(status).toBe(415);
  });

  it("a RIFF container that is not WebP", async () => {
    const wav = file([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")]);
    const { status } = await bodyOf(await validateUpload(wav));
    expect(status).toBe(415);
  });

  it("an ISO-BMFF file whose brand is not HEIC-family", async () => {
    const mp4 = file([0, 0, 0, 0x18, ...ascii("ftypisom")]);
    const { status } = await bodyOf(await validateUpload(mp4));
    expect(status).toBe(415);
  });
});
