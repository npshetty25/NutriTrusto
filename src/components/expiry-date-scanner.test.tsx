// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({ apiFetch }));

import ExpiryDateScanner from "./expiry-date-scanner";

const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff])], "date.jpg", { type: "image/jpeg" });
const respond = (body: unknown) => apiFetch.mockResolvedValue({ json: async () => body });

const setup = () => {
  const onResult = vi.fn();
  const onClose = vi.fn();
  render(<ExpiryDateScanner onResult={onResult} onClose={onClose} />);
  return { onResult, onClose };
};

// Braces matter: a function returned from beforeEach is run as a teardown, and
// mockReset() returns the mock itself.
beforeEach(() => {
  apiFetch.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("ExpiryDateScanner — inputs", () => {
  // Regression guard. Phase 1 found this component's Camera input had no
  // capture attribute, so on a phone it was indistinguishable from Gallery.
  it("opens the rear camera directly from the Camera input", () => {
    setup();
    const camera = screen.getByLabelText("Capture expiry date");
    expect(camera).toHaveAttribute("type", "file");
    expect(camera).toHaveAttribute("accept", "image/*");
    expect(camera).toHaveAttribute("capture", "environment");
  });

  it("leaves the Gallery input as a plain file chooser", () => {
    setup();
    const gallery = screen.getByLabelText("Upload expiry date photo");
    expect(gallery).toHaveAttribute("accept", "image/*");
    expect(gallery).not.toHaveAttribute("capture");
  });

  it("has a close control with an accessible name", async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Close expiry scanner" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("ExpiryDateScanner — reading a date", () => {
  it("posts the photo as the 'label' field to /api/scan-expiry-date", async () => {
    respond({ success: false });
    setup();
    await userEvent.upload(screen.getByLabelText("Capture expiry date"), photo());

    await waitFor(() => expect(apiFetch).toHaveBeenCalledOnce());
    const [url, init] = apiFetch.mock.calls[0] as [string, { method: string; body: FormData }];
    expect(url).toBe("/api/scan-expiry-date");
    expect(init.method).toBe("POST");
    expect(init.body.get("label")).toBeInstanceOf(File);
  });

  it("sends the phone's own date, so the server counts from the same today", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 9, 28, 1, 0)); // 1 am here; still the 27th in UTC
    respond({ success: false });
    setup();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).upload(screen.getByLabelText("Capture expiry date"), photo());
    await waitFor(() => expect(apiFetch).toHaveBeenCalledOnce());
    const [, init] = apiFetch.mock.calls[0] as [string, { body: FormData }];
    expect(init.body.get("today")).toBe("2026-10-28");
  });

  it("counts the days from the date itself, in this phone's calendar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 9, 10, 23, 30));
    // The server's count is a day out (its today is UTC); the date is what counts.
    respond({ success: true, expiry: { days_left: 43, expiry_date: "2026-11-21", source: "printed_expiry", confidence: "high", raw_text_found: null } });
    const { onResult } = setup();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).upload(screen.getByLabelText("Capture expiry date"), photo());
    await screen.findByText("Expiry date found!");
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ days_left: 42 }));
  });

  it("shows how the date was worked out, and warns when it has already passed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 9, 10, 12, 0));
    respond({
      success: true,
      expiry: { days_left: 0, expiry_date: "2026-09-30", source: "printed_expiry", confidence: "high", raw_text_found: "EXP SEP 2026", notes: ["The pack gives only the month, so this runs to the end of September 2026."] },
    });
    const { onResult } = setup();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).upload(screen.getByLabelText("Capture expiry date"), photo());
    expect(await screen.findByText(/already passed.*end of September 2026/)).toBeInTheDocument();
    // Held long enough to read, not whisked away after the usual 0.8 s.
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(onResult).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1800);
    });
    expect(onResult).toHaveBeenCalledOnce();
  });

  it("hands a confident result to the parent after the success flash", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 9, 10, 12, 0));
    const expiry = { days_left: 42, expiry_date: "2026-11-21", source: "printed_expiry", confidence: "high", raw_text_found: "EXP 21/11/2026" };
    respond({ success: true, expiry });
    const { onResult } = setup();

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).upload(screen.getByLabelText("Capture expiry date"), photo());
    await screen.findByText("Expiry date found!");
    expect(onResult).not.toHaveBeenCalled(); // not before the 800ms flash

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(onResult).toHaveBeenCalledWith(expiry);
  });

  it("warns, but still accepts, a medium-confidence date", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 9, 10, 12, 0));
    const expiry = { days_left: 10, expiry_date: "2026-10-20", source: "printed_expiry", confidence: "medium", raw_text_found: null };
    respond({ success: true, expiry });
    const { onResult } = setup();

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).upload(screen.getByLabelText("Capture expiry date"), photo());
    expect(await screen.findByText(/double-check against the physical package/)).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(2600);
    });
    expect(onResult).toHaveBeenCalledWith(expiry);
  });

  it("refuses a low-confidence reading instead of passing a guess on", async () => {
    const expiry = { days_left: 5, expiry_date: "2026-10-15", source: "printed_expiry", confidence: "low", raw_text_found: null };
    respond({ success: true, expiry });
    const { onResult } = setup();

    await userEvent.upload(screen.getByLabelText("Capture expiry date"), photo());
    expect(await screen.findByText(/No printed expiry date found/)).toBeInTheDocument();
    expect(onResult).not.toHaveBeenCalled();
  });

  it("refuses a result with no day count", async () => {
    respond({ success: true, expiry: { days_left: null, expiry_date: null, source: "unknown", confidence: "high", raw_text_found: null } });
    const { onResult } = setup();
    await userEvent.upload(screen.getByLabelText("Upload expiry date photo"), photo());
    expect(await screen.findByText(/No printed expiry date found/)).toBeInTheDocument();
    expect(onResult).not.toHaveBeenCalled();
  });

  it("shows a readable error when the server says it could not read the image", async () => {
    respond({ success: false, error: "Failed to read expiry date" });
    setup();
    await userEvent.upload(screen.getByLabelText("Capture expiry date"), photo());
    expect(await screen.findByText(/Couldn't read the date clearly/)).toBeInTheDocument();
  });

  it("shows a generic error, and recovers, when the request throws", async () => {
    apiFetch.mockRejectedValue(new Error("offline"));
    setup();
    await userEvent.upload(screen.getByLabelText("Capture expiry date"), photo());
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
    // Not stuck in the scanning state: both buttons usable again.
    expect(screen.getByRole("button", { name: /^Camera$/ })).toBeEnabled();
  });
});
