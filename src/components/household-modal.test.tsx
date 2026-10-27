// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const rpc = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
const refreshHousehold = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const lib = vi.hoisted(() => ({
  countPrivateItems: vi.fn(),
  shareMyItems: vi.fn(),
  leaveHousehold: vi.fn(),
  renameHousehold: vi.fn(),
  removeMember: vi.fn(),
  newInviteCode: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ supabase: { rpc } }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/context/auth-context", () => ({ useAuth: () => auth.current }));
vi.mock("@/lib/household", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/household")>()),
  ...lib,
}));

import { HouseholdModal } from "./household-modal";

const USER = { id: "u-1", user_metadata: { full_name: "Asha Rao" } };
const HOUSEHOLD = { id: "h-1", name: "Asha's Household", inviteCode: "a1b2c3d4e5f6" };
const MEMBERS = [
  { userId: "u-1", displayName: "Asha Rao", joinedAt: null, isCreator: true },
  { userId: "u-2", displayName: "Ravi", joinedAt: null, isCreator: false },
];

const signedIn = (overrides: Record<string, unknown> = {}) => {
  auth.current = {
    user: USER,
    household: null,
    householdLoading: false,
    refreshHousehold,
    householdMembers: [],
    householdV2Ready: null,
    ...overrides,
  };
};

beforeEach(() => {
  rpc.mockReset();
  toast.mockReset();
  refreshHousehold.mockReset().mockResolvedValue(undefined);
  lib.countPrivateItems.mockReset().mockResolvedValue(0);
  lib.shareMyItems.mockReset().mockResolvedValue(3);
  lib.leaveHousehold.mockReset().mockResolvedValue(true);
  lib.renameHousehold.mockReset().mockResolvedValue(true);
  lib.removeMember.mockReset().mockResolvedValue(true);
  lib.newInviteCode.mockReset().mockResolvedValue("ffffeeeedddd");
  signedIn();
});

const open = (props: { initialJoinCode?: string } = {}) => render(<HouseholdModal onClose={vi.fn()} {...props} />);

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

  it("fills the code in from an invite link", () => {
    open({ initialJoinCode: "a1b2c3d4e5f6" });
    expect(screen.getByPlaceholderText("Enter invite code")).toHaveValue("a1b2c3d4e5f6");
  });

  it("says the code is invalid when the database refuses it, and does not refresh", async () => {
    rpc.mockResolvedValue({ error: { code: "P0001", message: "Invalid invite code" } });
    open();
    await userEvent.type(screen.getByPlaceholderText("Enter invite code"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(await screen.findByText("Invalid invite code. Double-check and try again.")).toBeInTheDocument();
    expect(refreshHousehold).not.toHaveBeenCalled();
  });

  it("says plainly when the person is already in a household", async () => {
    rpc.mockResolvedValue({ error: { code: "P0002", message: "You are already in a household" } });
    open();
    await userEvent.type(screen.getByPlaceholderText("Enter invite code"), "a1b2c3d4e5f6");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText(/already in a household/)).toBeInTheDocument();
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

  it("uses the name typed in, when there is one", async () => {
    rpc.mockResolvedValue({ error: null });
    open();
    await userEvent.type(screen.getByLabelText("Start a household"), "Rao family");
    await userEvent.click(screen.getByRole("button", { name: /Create a Household/ }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("create_household", { new_name: "Rao family" }));
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

  it("asks before leaving, then leaves taking the user's items back", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: /Leave Household/ }));
    expect(lib.leaveHousehold).not.toHaveBeenCalled();
    expect(screen.getByText(/Items you added come back to your private pantry/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Yes, leave/ }));
    await waitFor(() => expect(lib.leaveHousehold).toHaveBeenCalledWith("u-1", "h-1"));
    await waitFor(() => expect(refreshHousehold).toHaveBeenCalledOnce());
    expect(toast).toHaveBeenCalledWith("Left household", expect.anything());
  });

  it("reports a failed leave and stays in the household", async () => {
    lib.leaveHousehold.mockResolvedValue(false);
    open();
    await userEvent.click(screen.getByRole("button", { name: /Leave Household/ }));
    await userEvent.click(screen.getByRole("button", { name: /Yes, leave/ }));
    expect(await screen.findByText("Couldn't leave the household. Please try again.")).toBeInTheDocument();
    expect(refreshHousehold).not.toHaveBeenCalled();
  });

  it("says how many of the user's items are still private, and shares them", async () => {
    lib.countPrivateItems.mockResolvedValue(3);
    open();
    expect(await screen.findByText("3 items of yours are private")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Share them with the household/ }));
    await waitFor(() => expect(lib.shareMyItems).toHaveBeenCalledWith("u-1", "h-1"));
    await waitFor(() => expect(screen.queryByText(/of yours are private/)).not.toBeInTheDocument());
  });

  it("renames the household", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: "Rename household" }));
    const field = screen.getByLabelText("Household name");
    await userEvent.clear(field);
    await userEvent.type(field, "Rao family");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(lib.renameHousehold).toHaveBeenCalledWith("h-1", "Rao family"));
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

describe("HouseholdModal — members", () => {
  it("lists members; the creator can remove others and make a new code", async () => {
    signedIn({ household: HOUSEHOLD, householdMembers: MEMBERS, householdV2Ready: true });
    open();
    expect(screen.getByText("Asha Rao (you)")).toBeInTheDocument();
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Asha Rao" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove Ravi" }));
    await waitFor(() => expect(lib.removeMember).toHaveBeenCalledWith("u-2"));

    await userEvent.click(screen.getByRole("button", { name: /New code/ }));
    await waitFor(() => expect(lib.newInviteCode).toHaveBeenCalled());
  });

  it("gives a member who did not create the household no remove or new-code controls", () => {
    signedIn({
      user: { id: "u-2", user_metadata: { full_name: "Ravi" } },
      household: HOUSEHOLD,
      householdMembers: MEMBERS,
      householdV2Ready: true,
    });
    open();
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New code/ })).not.toBeInTheDocument();
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
