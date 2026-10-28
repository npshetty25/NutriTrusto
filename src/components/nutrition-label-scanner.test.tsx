// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({ apiFetch }));

import NutritionLabelScanner from "./nutrition-label-scanner";

const photo = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "label.png", { type: "image/png" });
const respond = (body: unknown) => apiFetch.mockResolvedValue({ json: async () => body });

const setup = () => {
  const onResult = vi.fn();
  const onClose = vi.fn();
  render(<NutritionLabelScanner onResult={onResult} onClose={onClose} />);
  return { onResult, onClose };
};
const camera = () => screen.getByLabelText("Capture nutrition label");

// Braces matter: a function returned from beforeEach is run as a teardown, and
// mockReset() returns the mock itself.
beforeEach(() => {
  apiFetch.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("NutritionLabelScanner — inputs", () => {
  // Same Phase 1 regression guard as the expiry scanner.
  it("opens the rear camera directly from the Camera input", () => {
    setup();
    expect(camera()).toHaveAttribute("capture", "environment");
    expect(camera()).toHaveAttribute("accept", "image/*");
  });

  it("leaves the Gallery input as a plain file chooser", () => {
    setup();
    expect(screen.getByLabelText("Upload nutrition label")).not.toHaveAttribute("capture");
  });

  it("closes", async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Close nutrition scanner" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("NutritionLabelScanner — reading a label", () => {
  it("posts the photo as the 'label' field to /api/scan-nutrition-label", async () => {
    respond({ success: false });
    setup();
    await userEvent.upload(camera(), photo());
    await waitFor(() => expect(apiFetch).toHaveBeenCalledOnce());
    const [url, init] = apiFetch.mock.calls[0] as [string, { body: FormData }];
    expect(url).toBe("/api/scan-nutrition-label");
    expect(init.body.get("label")).toBeInstanceOf(File);
  });

  it("returns the nutrition table to the parent after the success flash", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const nutrition = { sugars_g: 4, sodium_mg: 220, protein_g: 9, per_unit: "100g", confidence: "high" };
    respond({ success: true, nutrition });
    const { onResult } = setup();

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).upload(camera(), photo());
    await waitFor(() => expect(screen.queryByText(/Reading/i)).not.toBeInTheDocument());
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(onResult).toHaveBeenCalledWith(nutrition);
  });

  it("warns on medium confidence but still returns the values", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const nutrition = { sugars_g: 4, confidence: "medium" };
    respond({ success: true, nutrition });
    const { onResult } = setup();

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).upload(camera(), photo());
    expect(await screen.findByText(/Some values may be inaccurate/)).toBeInTheDocument();
    // Held long enough to read, not whisked away after the usual 0.8 s.
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(onResult).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1800);
    });
    expect(onResult).toHaveBeenCalledWith(nutrition);
  });

  it("rejects a low-confidence table", async () => {
    respond({ success: true, nutrition: { sugars_g: 4, confidence: "low" } });
    const { onResult } = setup();
    await userEvent.upload(camera(), photo());
    expect(await screen.findByText(/hard to read clearly/)).toBeInTheDocument();
    expect(onResult).not.toHaveBeenCalled();
  });

  it("refuses per-serving values it could not convert, rather than scoring them as per 100 g", async () => {
    respond({ success: true, nutrition: { sugars_g: 4, sodium_mg: 200, per_unit: "serving", confidence: "high" } });
    const { onResult } = setup();
    await userEvent.upload(camera(), photo());
    expect(await screen.findByText(/per serving without the serving weight/)).toBeInTheDocument();
    expect(onResult).not.toHaveBeenCalled();
  });

  it("rejects a table in which every tracked value is null", async () => {
    respond({
      success: true,
      nutrition: { sugars_g: null, sodium_mg: null, protein_g: null, fibre_g: null, saturated_fat_g: null, confidence: "high" },
    });
    const { onResult } = setup();
    await userEvent.upload(camera(), photo());
    expect(await screen.findByText(/No nutrition values detected/)).toBeInTheDocument();
    expect(onResult).not.toHaveBeenCalled();
  });

  it("shows a readable error when the server could not read the label", async () => {
    respond({ success: false });
    setup();
    await userEvent.upload(camera(), photo());
    expect(await screen.findByText(/Couldn't read the label clearly/)).toBeInTheDocument();
  });

  it("shows a generic error when the request throws", async () => {
    apiFetch.mockRejectedValue(new Error("offline"));
    setup();
    await userEvent.upload(camera(), photo());
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });
});
