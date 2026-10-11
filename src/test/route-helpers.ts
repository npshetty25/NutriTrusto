import { vi } from "vitest";

/**
 * Shared fixtures for API-route tests. Routes are called directly with a real
 * `Request`, so multipart parsing, upload validation and response shapes are
 * the production code paths; only Gemini and Supabase auth are replaced.
 */

/** First bytes of a JPEG; what upload-validation actually checks. */
export const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
export const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47];

/** A File whose magic bytes are `header`, padded so it has some size. */
export function fileWithHeader(
  header: number[] = JPEG_HEADER,
  { name = "receipt.jpg", type = "image/jpeg", size = 64 }: { name?: string; type?: string; size?: number } = {}
): File {
  const bytes = new Uint8Array(Math.max(size, header.length));
  bytes.set(header, 0);
  return new File([bytes], name, { type });
}

export function multipartRequest(field: string, file: File | null, url = "http://localhost/api/test"): Request {
  const form = new FormData();
  if (file) form.append(field, file);
  return new Request(url, { method: "POST", body: form });
}

/** The slice of a Gemini result the routes read: `result.response.text()`. */
export const geminiText = (text: string) => ({ response: { text: () => text } });

export const TEST_USER = (id: string) => ({ id, email: `${id}@example.test` });

/** The routes log one line per step; keep that out of test output. */
export function silenceLogs() {
  for (const level of ["info", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
}
