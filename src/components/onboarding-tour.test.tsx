// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingTour, TOUR_STEPS, hasSeenOnboarding, markOnboardingSeen } from "./onboarding-tour";

/** Stand-ins for the real bottom-nav buttons the tour points at. */
function TourTargets() {
  return (
    <div>
      <button data-tour="receipt">Receipt</button>
      <button data-tour="barcode">Barcode</button>
      <button data-tour="askAi">Ask AI</button>
    </div>
  );
}

const open = (onFinish = vi.fn()) => {
  const utils = render(
    <>
      <TourTargets />
      <OnboardingTour onFinish={onFinish} />
    </>
  );
  return { onFinish, ...utils };
};

beforeEach(() => localStorage.clear());

describe("OnboardingTour — steps", () => {
  it("starts on the welcome step, with no Back button and no highlight ring", () => {
    open();
    expect(screen.getByRole("heading", { name: TOUR_STEPS[0].title })).toBeInTheDocument();
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("walks through all four steps on Next, then calls onFinish on the last", async () => {
    const { onFinish } = open();
    for (let i = 1; i < TOUR_STEPS.length; i++) {
      await userEvent.click(screen.getByRole("button", { name: /Next/ }));
      expect(screen.getByRole("heading", { name: TOUR_STEPS[i].title })).toBeInTheDocument();
      expect(screen.getByText(`${i + 1} of ${TOUR_STEPS.length}`)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("goes back a step without losing place, and loses Back again on step 1", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("3 of 4")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: TOUR_STEPS[1].title })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: TOUR_STEPS[0].title })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("the Skip button finishes immediately from any step", async () => {
    const { onFinish } = open();
    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    await userEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("Escape finishes the tour", async () => {
    const { onFinish } = open();
    await userEvent.keyboard("{Escape}");
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("each of the three anchored steps names a real data-tour target that exists in STEPS", () => {
    const targets = TOUR_STEPS.slice(1).map((s) => s.target);
    expect(targets).toEqual(["receipt", "barcode", "askAi"]);
  });
});

describe("hasSeenOnboarding / markOnboardingSeen", () => {
  it("is unseen until marked, per user id, and does not leak between users", () => {
    expect(hasSeenOnboarding("user-a")).toBe(false);
    markOnboardingSeen("user-a");
    expect(hasSeenOnboarding("user-a")).toBe(true);
    expect(hasSeenOnboarding("user-b")).toBe(false);
  });

  it("treats a broken localStorage as already-seen rather than looping forever", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: () => {
          throw new Error("storage disabled");
        },
        setItem: () => {
          throw new Error("storage disabled");
        },
      },
      configurable: true,
    });
    expect(hasSeenOnboarding("user-c")).toBe(true);
    expect(() => markOnboardingSeen("user-c")).not.toThrow();
    if (original) Object.defineProperty(window, "localStorage", original);
  });
});
