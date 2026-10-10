// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const rpc = vi.hoisted(() => vi.fn());
const eqUser = vi.hoisted(() => vi.fn());
const eqHousehold = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
const refreshHousehold = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/lib/supabase", () => ({ supabase: { rpc, from } }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/context/auth-context", () => ({ useAuth: () => auth.current }));

import { HouseholdModal } from "./household-modal";

const USER = { id: "u-1", user_metadata: { full_name: "Asha Rao" } };
const HOUSEHOLD = { id: "h-1", name: "Asha's Household", inviteCode: "a1b2c3d4e5f6" };

const signedIn = (overrides: Record<string, unknown> = {}) => {
  auth.current = { user: USER, household: null, householdLoading: false, refreshHousehold, ...overrides };
};

beforeEach(() => {
  rpc.mockReset();
  toast.mockReset();
  refreshHousehold.mockReset().mockResolvedValue(undefined);
  eqUser.mockReset().mockResolvedValue({ error: null });
  eqHousehold.mockReset().mockReturnValue({ eq: eqUser });
  del.mockReset().mockReturnValue({ eq: eqHousehold });
  from.mockReset().mockReturnValue({ delete: del });
  signedIn();
});

const open = () => render(<HouseholdModal onClose={vi.fn()} />);

describe("HouseholdModal — joining", () => {
  it("asks for a code instead of calling the database when the field is empty", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(screen.getByText("Enter an invite code.")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("joins by the trimmed code, refreshes the household and confirms", async () => {
    rpc.mockResolvedValue({ error: null });
    open();
    await userEvent.type(screen.getByPlaceholderText("Enter invite code"), "  a1b2c3d4e5f6  ");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith("join_household_by_code", { code: "a1b2c3d4e5f6" }));
    await waitFor(() => expect(refreshHousehold).toHaveBeenCalledOnce());
    expect(toast).toHaveBeenCalledWith("Joined household", expect.anything());
    expect(screen.getByPlaceholderText("Enter invite code")).toHaveValue("");
  });

  it("says the code is invalid when the database refuses it, and does not refresh", async () => {
    rpc.mockResolvedValue({ error: { code: "P0001", message: "Invalid invite code" } });
    open();
    await userEvent.type(screen.getByPlaceholderText("Enter invite code"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(await screen.findByText("Invalid invite code. Double-check and try again.")).toBeInTheDocument();
    expect(refreshHousehold).not.toHaveBeenCalled();
  });

  it("explains a missing migration instead of blaming the code", async () => {
    rpc.mockResolvedValue({ error: { code: "PGRST202", message: "Could not find the function" } });
    open();
    await userEvent.type(screen.getByPlaceholderText("Enter invite code"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText(/migration hasn't been run/)).toBeInTheDocument();
  });
});

describe("HouseholdModal — creating", () => {
  it("creates a household named after the user via the atomic RPC", async () => {
    rpc.mockResolvedValue({ error: null });
    open();
    await userEvent.click(screen.getByRole("button", { name: /Create a Household/ }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith("create_household", { new_name: "Asha Rao's Household" }));
    await waitFor(() => expect(refreshHousehold).toHaveBeenCalledOnce());
    expect(toast).toHaveBeenCalledWith("Household created", expect.anything());
  });

  it("calls it \"My Household\" when the profile has no name", async () => {
    signedIn({ user: { id: "u-2", user_metadata: {} } });
    rpc.mockResolvedValue({ error: null });
    open();
    await userEvent.click(screen.getByRole("button", { name: /Create a Household/ }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("create_household", { new_name: "My Household" }));
  });

  it("shows an error and does not refresh when creation fails", async () => {
    rpc.mockResolvedValue({ error: { code: "42501", message: "permission denied" } });
    open();
    await userEvent.click(screen.getByRole("button", { name: /Create a Household/ }));
    expect(await screen.findByText("Couldn't create a household. Please try again.")).toBeInTheDocument();
    expect(refreshHousehold).not.toHaveBeenCalled();
  });
});

describe("HouseholdModal — an existing household", () => {
  beforeEach(() => signedIn({ household: HOUSEHOLD }));

  it("shows the name and invite code, and offers neither create nor join", () => {
    open();
    expect(screen.getByText("Asha's Household")).toBeInTheDocument();
    expect(screen.getByText("a1b2c3d4e5f6")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create a Household/ })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Enter invite code")).not.toBeInTheDocument();
  });

  it("leaves by deleting only the caller's own membership row", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: /Leave Household/ }));

    await waitFor(() => expect(from).toHaveBeenCalledWith("household_members"));
    expect(eqHousehold).toHaveBeenCalledWith("household_id", "h-1");
    expect(eqUser).toHaveBeenCalledWith("user_id", "u-1");
    await waitFor(() => expect(refreshHousehold).toHaveBeenCalledOnce());
    expect(toast).toHaveBeenCalledWith("Left household", expect.anything());
  });

  it("reports a failed leave and stays in the household", async () => {
    eqUser.mockResolvedValue({ error: { message: "network" } });
    open();
    await userEvent.click(screen.getByRole("button", { name: /Leave Household/ }));
    expect(await screen.findByText("Couldn't leave the household. Please try again.")).toBeInTheDocument();
    expect(refreshHousehold).not.toHaveBeenCalled();
  });

  it("copies the invite code to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    open();
    await userEvent.click(screen.getByRole("button", { name: "Copy invite code" }));
    expect(writeText).toHaveBeenCalledWith("a1b2c3d4e5f6");
  });

  it("shows the code in a toast when the clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    open();
    await userEvent.click(screen.getByRole("button", { name: "Copy invite code" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Copy failed", { description: "Invite code: a1b2c3d4e5f6" }));
  });
});

describe("HouseholdModal — loading", () => {
  it("shows neither form nor household while the lookup is in flight", () => {
    signedIn({ householdLoading: true });
    open();
    expect(screen.queryByRole("button", { name: /Create a Household/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Leave Household/ })).not.toBeInTheDocument();
  });
});
