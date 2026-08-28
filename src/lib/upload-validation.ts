import { NextResponse } from "next/server";

/**
 * Validation for the three routes that accept a file upload.
 *
 * They previously took whatever arrived: any size, any MIME type, straight
 * into a Gemini vision call. A 200 MB file, or a .zip renamed to .jpg, was
 * accepted and paid for exactly like a photo of a receipt.
 *
 * The type check reads the file's magic bytes rather than trusting
 * `file.type`, which is attacker-controlled and copied verbatim from the
 * client's multipart headers.
 */

// Gemini's own inline-data ceiling is well above this. 10 MB is generous for
// a phone photo of a receipt and small enough that a bad request fails fast.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_LABEL = "JPEG, PNG, WebP, HEIC or PDF";

type Signature = { mime: string; test: (b: Uint8Array) => boolean };

const SIGNATURES: Signature[] = [
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "application/pdf", test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  // RIFF....WEBP
  {
    mime: "image/webp",
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  // ....ftypheic / ftypheix / ftypmif1 — the ISO-BMFF box used by iPhone photos
  {
    mime: "image/heic",
    test: (b) =>
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 &&
      [0x68, 0x6d].includes(b[8]),
  },
];

// A discriminated union rather than a boolean: on success it hands back the
// non-null File, so callers get narrowing for free instead of casting.
export type UploadCheck =
  | {
      ok: true;
      file: File;
      /** The MIME type proven by the file's own bytes, not by its headers. */
      mime: string;
    }
  | { ok: false; response: NextResponse };

const reject = (message: string, status = 400): UploadCheck => ({
  ok: false,
  response: NextResponse.json({ success: false, error: message }, { status }),
});

export async function validateUpload(file: File | null): Promise<UploadCheck> {
  if (!file) return reject("No image provided");

  if (file.size === 0) return reject("That file is empty. Try taking the photo again.");

  if (file.size > MAX_UPLOAD_BYTES) {
    return reject(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please use one under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
      413
    );
  }

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const match = SIGNATURES.find((s) => s.test(head));
  if (!match) {
    return reject(`That does not look like an image. Please upload a ${ALLOWED_LABEL} file.`, 415);
  }

  return { ok: true, file, mime: match.mime };
}
