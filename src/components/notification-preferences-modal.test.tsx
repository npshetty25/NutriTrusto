// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const updateUser = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/lib/supabase", () => ({ supabase: { auth: { updateUser } } }));
vi.mock("@/context/auth-context", () => ({ useAuth: () => auth.current }));

import { NotificationPreferencesModal } from "./notification-preferences-modal";

const signedIn = (metadata: Record<string, unknown> = {}) => {
  auth.current = { user: { id: "u-1", user_metadata: metadata } };
};

beforeEach(() => {
  updateUser.mockReset().mockResolvedValue({ error: null });
  signedIn();
});

const open = () => render(<NotificationPreferencesModal onClose={vi.fn()} />);

describe("NotificationPreferencesModal — defaults", () => {
  it("defaults to reminders on and 3 days before, matching what the app always did", () => {
    open();
    expect(screen.getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "3d" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reads the stored values when they exist", () => {
    signedIn({ notifications_enabled: false, notify_days_before: 7 });
    open();
    expect(screen.getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "7d" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("NotificationPreferencesModal — saving", () => {
  it("saves the toggle immediately on click, to user_metadata", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: "Off" }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ data: { notifications_enabled: false } }));
    expect(await screen.findAllByText("Saved")).toHaveLength(1);
  });

  it("saves the days-before threshold immediately on click", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: "5d" }));
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ data: { notify_days_before: 5 } }));
  });

  it("disables the days-before row once reminders are off", () => {
    signedIn({ notifications_enabled: false });
    open();
    expect(screen.getByRole("button", { name: "3d" })).toBeDisabled();
  });

  it("does not call Supabase again for the option already selected", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: "On" }));
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("shows an error and does not crash when the save fails", async () => {
    updateUser.mockResolvedValue({ error: { message: "network down" } });
    open();
    await userEvent.click(screen.getByRole("button", { name: "Off" }));
    expect(await screen.findByText("Couldn't save that. Please try again.")).toBeInTheDocument();
  });
});
