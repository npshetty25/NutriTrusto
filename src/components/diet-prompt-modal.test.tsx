// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const updateUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { updateUser } } }));

import { DietPromptModal } from "./diet-prompt-modal";

beforeEach(() => updateUser.mockReset().mockResolvedValue({ error: null }));

describe("DietPromptModal", () => {
  it("offers the three diets and has no way to dismiss it", () => {
    render(<DietPromptModal />);
    expect(screen.getByRole("dialog", { name: "How do you eat?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vegetarian/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Eggtarian/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Non-vegetarian/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /close|skip|later/i })).not.toBeInTheDocument();
  });

  it.each([
    [/Vegetarian/, "veg"],
    [/Eggtarian/, "eggtarian"],
    [/Non-vegetarian/, "non-veg"],
  ])("saves %s as dietary_preference %s on the account", async (name, stored) => {
    render(<DietPromptModal />);
    await userEvent.click(screen.getByRole("button", { name }));
    expect(updateUser).toHaveBeenCalledWith({ data: { dietary_preference: stored } });
  });

  it("says so and lets them try again when saving fails", async () => {
    updateUser.mockResolvedValueOnce({ error: { message: "network" } });
    render(<DietPromptModal />);
    await userEvent.click(screen.getByRole("button", { name: /Vegetarian/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save that");
    expect(screen.getByRole("button", { name: /Vegetarian/ })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: /Vegetarian/ }));
    expect(updateUser).toHaveBeenCalledTimes(2);
  });
});
