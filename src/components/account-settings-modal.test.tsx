// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const updateUser = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/lib/supabase", () => ({ supabase: { auth: { updateUser } } }));
vi.mock("@/context/auth-context", () => ({ useAuth: () => auth.current }));

import { AccountSettingsModal } from "./account-settings-modal";

const EMAIL_USER = {
  id: "u-1",
  email: "asha@example.test",
  user_metadata: { full_name: "Asha Rao" },
  app_metadata: { provider: "email" },
  identities: [{ provider: "email" }],
};

const GOOGLE_USER = {
  id: "u-2",
  email: "asha@gmail.com",
  user_metadata: { full_name: "Asha Rao" },
  app_metadata: { provider: "google" },
  identities: [{ provider: "google" }],
};

const signedIn = (user: Record<string, unknown> = EMAIL_USER) => {
  auth.current = { user };
};

beforeEach(() => {
  updateUser.mockReset().mockResolvedValue({ error: null });
  signedIn();
});

const open = () => render(<AccountSettingsModal onClose={vi.fn()} />);

describe("AccountSettingsModal — display name", () => {
  it("prefills the current name and disables Save until it changes", () => {
    open();
    const input = screen.getByPlaceholderText("Your name") as HTMLInputElement;
    expect(input.value).toBe("Asha Rao");
    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    expect(saveButtons[0]).toBeDisabled();
  });

  it("saves a changed name to user_metadata", async () => {
    open();
    const input = screen.getByPlaceholderText("Your name");
    await userEvent.clear(input);
    await userEvent.type(input, "Asha K Rao");
    await userEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ data: { full_name: "Asha K Rao" } }));
  });

  it("rejects a name that is not a name, without calling Supabase", async () => {
    open();
    const input = screen.getByPlaceholderText("Your name");
    await userEvent.clear(input);
    await userEvent.type(input, "1234");
    await userEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    expect(await screen.findByText(/can only contain letters/)).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe("AccountSettingsModal — email, on an email/password account", () => {
  it("prefills the current email and saves a changed, trimmed, lower-cased one", async () => {
    open();
    const input = screen.getByPlaceholderText("name@example.com") as HTMLInputElement;
    expect(input.value).toBe("asha@example.test");
    await userEvent.clear(input);
    await userEvent.type(input, "  Asha.New@Example.TEST ");
    await userEvent.click(screen.getAllByRole("button", { name: "Save" })[1]);
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ email: "asha.new@example.test" }));
  });

  it("rejects a made-up email without calling Supabase", async () => {
    open();
    const input = screen.getByPlaceholderText("name@example.com");
    await userEvent.clear(input);
    await userEvent.type(input, "abc@xyz");
    await userEvent.click(screen.getAllByRole("button", { name: "Save" })[1]);
    expect(await screen.findByText("That doesn't look like a valid email address.")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe("AccountSettingsModal — password, on an email/password account", () => {
  it("rejects a weak password", async () => {
    open();
    await userEvent.type(screen.getByPlaceholderText("New password"), "abcdefgh");
    await userEvent.type(screen.getByPlaceholderText("Confirm new password"), "abcdefgh");
    await userEvent.click(screen.getAllByRole("button", { name: "Save" })[2]);
    expect(await screen.findByText("Use at least one letter and one number.")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords", async () => {
    open();
    await userEvent.type(screen.getByPlaceholderText("New password"), "pantry2026");
    await userEvent.type(screen.getByPlaceholderText("Confirm new password"), "pantry2027");
    await userEvent.click(screen.getAllByRole("button", { name: "Save" })[2]);
    expect(await screen.findByText("Those two passwords don't match.")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("saves a valid, matching new password and clears the fields", async () => {
    open();
    const pw = screen.getByPlaceholderText("New password") as HTMLInputElement;
    const confirm = screen.getByPlaceholderText("Confirm new password") as HTMLInputElement;
    await userEvent.type(pw, "pantry2026");
    await userEvent.type(confirm, "pantry2026");
    await userEvent.click(screen.getAllByRole("button", { name: "Save" })[2]);
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "pantry2026" }));
    await waitFor(() => expect(pw.value).toBe(""));
    expect(confirm.value).toBe("");
  });
});

describe("AccountSettingsModal — a Google-only account", () => {
  beforeEach(() => signedIn(GOOGLE_USER));

  it("shows the email as read-only text instead of an editable field", () => {
    open();
    expect(screen.getByText("asha@gmail.com")).toBeInTheDocument();
    expect(screen.getByText("Managed by your Google account.")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("name@example.com")).not.toBeInTheDocument();
  });

  it("hides the password field entirely", () => {
    open();
    expect(screen.queryByPlaceholderText("New password")).not.toBeInTheDocument();
  });

  it("still lets the display name be changed", () => {
    open();
    expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument();
  });
});

describe("AccountSettingsModal — account deletion", () => {
  it("is a mailto link addressed to the project's contact email, naming the account", () => {
    open();
    const link = screen.getByRole("link", { name: /Request Account Deletion/ });
    const href = decodeURIComponent(link.getAttribute("href") || "");
    expect(href).toContain("mailto:nirav.mitmpl2023@learner.manipal.edu");
    expect(href).toContain("asha@example.test");
  });

  it("confirms the request after the link is clicked", async () => {
    open();
    await userEvent.click(screen.getByRole("link", { name: /Request Account Deletion/ }));
    expect(await screen.findByText(/Opened an email to/)).toBeInTheDocument();
  });
});
