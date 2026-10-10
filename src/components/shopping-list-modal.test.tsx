// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type Call = { method: string; args: unknown[] };
type Result = { data?: unknown; error?: { code?: string; message?: string } | null };

const state = vi.hoisted(() => ({
  calls: [] as Array<{ method: string; args: unknown[] }>,
  // What the awaited chain resolves to, keyed by the terminal verb of the query.
  results: {} as Record<string, unknown>,
}));
const from = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({ supabase: { from } }));
// One object for the life of the file: the component refetches whenever `user`
// changes identity, as the real provider never does between renders.
const auth = vi.hoisted(() => ({ value: { user: { id: "u-1" } } }));
vi.mock("@/context/auth-context", () => ({ useAuth: () => auth.value }));

import ShoppingListModal from "./shopping-list-modal";

/**
 * A chainable stand-in for a PostgREST query builder. Every method records
 * itself and returns the same object; awaiting it resolves to whatever the
 * test registered for that query's verb (select / insert / update / delete).
 */
function chain(): unknown {
  const methods: string[] = [];
  const proxy: unknown = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") {
          const verb = ["insert", "update", "delete"].find((v) => methods.includes(v)) ?? "select";
          const result = (state.results[verb] ?? { data: [], error: null }) as Result;
          return (resolve: (v: Result) => unknown) => Promise.resolve(result).then(resolve);
        }
        return (...args: unknown[]) => {
          methods.push(prop);
          state.calls.push({ method: prop, args });
          return proxy;
        };
      },
    }
  );
  return proxy;
}

const calls = (method: string): Call[] => state.calls.filter((c) => c.method === method);

const ROWS = [
  { id: "r1", name: "Milk", source_recipe: null, checked: false, created_at: "2026-10-03T10:00:00Z" },
  { id: "r2", name: "Fresh coriander — 1 bunch", source_recipe: "Palak Paneer", checked: false, created_at: "2026-10-02T10:00:00Z" },
  { id: "r3", name: "Atta", source_recipe: null, checked: true, created_at: "2026-10-01T10:00:00Z" },
];

beforeEach(() => {
  state.calls = [];
  state.results = { select: { data: ROWS, error: null } };
  from.mockReset().mockImplementation(() => chain());
});

const open = async () => {
  render(<ShoppingListModal onClose={vi.fn()} />);
};
const itemNames = () =>
  screen
    .getAllByRole("button", { name: /Mark as (not )?bought/ })
    .map((b) => b.closest("div.rounded-xl")!.querySelector("p")!.textContent);

describe("ShoppingListModal — loading", () => {
  it("lists the rows, unchecked first, and splits a recipe quantity from the name", async () => {
    await open();
    await screen.findByText("Milk");
    expect(screen.getByText("Fresh coriander")).toBeInTheDocument();
    expect(screen.getByText("1 bunch")).toBeInTheDocument();
    expect(screen.getByText("For Palak Paneer")).toBeInTheDocument();
    expect(itemNames()).toEqual(["Milk", "Fresh coriander1 bunch", "Atta"]);
  });

  it("asks the database for unchecked-first, newest-first", async () => {
    await open();
    await screen.findByText("Milk");
    expect(calls("order").map((c) => c.args)).toEqual([
      ["checked", { ascending: true }],
      ["created_at", { ascending: false }],
    ]);
  });

  it("says the list is empty when it is", async () => {
    state.results.select = { data: [], error: null };
    await open();
    expect(await screen.findByText("Your shopping list is empty.")).toBeInTheDocument();
  });

  it("explains a missing migration rather than showing a generic failure", async () => {
    state.results.select = { data: null, error: { code: "PGRST205", message: "relation does not exist" } };
    await open();
    expect(await screen.findByText(/migration hasn't been run/)).toBeInTheDocument();
  });

  it("shows a plain error for any other load failure", async () => {
    state.results.select = { data: null, error: { code: "500", message: "boom" } };
    await open();
    expect(await screen.findByText("Couldn't load your shopping list.")).toBeInTheDocument();
  });
});

describe("ShoppingListModal — editing", () => {
  it("adds an item for the signed-in user and puts it at the top", async () => {
    state.results.insert = {
      data: { id: "r9", name: "Ghee", source_recipe: null, checked: false, created_at: "2026-10-10T10:00:00Z" },
      error: null,
    };
    await open();
    await screen.findByText("Milk");

    await userEvent.type(screen.getByPlaceholderText("Add an item..."), "  Ghee  ");
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() => expect(calls("insert")).toHaveLength(1));
    expect(calls("insert")[0].args).toEqual([[{ user_id: "u-1", name: "Ghee" }]]);
    expect(await screen.findByText("Ghee")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add an item...")).toHaveValue("");
    expect(itemNames()[0]).toBe("Ghee");
  });

  it("does not insert a blank name", async () => {
    await open();
    await screen.findByText("Milk");
    await userEvent.type(screen.getByPlaceholderText("Add an item..."), "   ");
    expect(screen.getByRole("button", { name: "Add item" })).toBeDisabled();
    expect(calls("insert")).toHaveLength(0);
  });

  it("keeps the list and shows an error when the insert fails", async () => {
    state.results.insert = { data: null, error: { message: "denied" } };
    await open();
    await screen.findByText("Milk");
    await userEvent.type(screen.getByPlaceholderText("Add an item..."), "Ghee");
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(await screen.findByText("Couldn't add item. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText("Ghee")).not.toBeInTheDocument();
  });

  it("toggles an item optimistically and persists the new state by id", async () => {
    await open();
    await screen.findByText("Milk");
    const milk = screen.getAllByRole("button", { name: "Mark as bought" })[0];
    await userEvent.click(milk);

    await waitFor(() => expect(calls("update")).toHaveLength(1));
    expect(calls("update")[0].args).toEqual([{ checked: true }]);
    expect(calls("eq").some((c) => c.args[0] === "id" && c.args[1] === "r1")).toBe(true);
    // Optimistic: the box flipped without waiting on the round trip.
    expect(screen.getAllByRole("button", { name: "Mark as not bought" })).toHaveLength(2);
  });

  it("removes an item locally and by id", async () => {
    await open();
    await screen.findByText("Milk");
    const row = screen.getByText("Milk").closest("div.rounded-xl") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Remove item" }));

    await waitFor(() => expect(calls("delete")).toHaveLength(1));
    expect(calls("eq").some((c) => c.args[0] === "id" && c.args[1] === "r1")).toBe(true);
    expect(screen.queryByText("Milk")).not.toBeInTheDocument();
  });

  it("clears only the checked items, in one delete", async () => {
    await open();
    await screen.findByText("Milk");
    await userEvent.click(screen.getByRole("button", { name: "Clear checked items" }));

    await waitFor(() => expect(calls("delete")).toHaveLength(1));
    expect(calls("in")[0].args).toEqual(["id", ["r3"]]);
    expect(screen.queryByText("Atta")).not.toBeInTheDocument();
    expect(screen.getByText("Milk")).toBeInTheDocument();
  });
});

describe("ShoppingListModal — view options", () => {
  it("hides bought items and says so", async () => {
    await open();
    await screen.findByText("Milk");
    await userEvent.click(screen.getByRole("button", { name: "Hide Bought" }));
    expect(screen.queryByText("Atta")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Showing Unbought" })).toBeInTheDocument();
  });

  it("sorts by name but never lifts a checked item above an unchecked one", async () => {
    await open();
    await screen.findByText("Milk");
    await userEvent.selectOptions(screen.getByTitle("Sort"), "name");
    // Alphabetically "Atta" would be first; it is checked, so it stays last.
    expect(itemNames()).toEqual(["Fresh coriander1 bunch", "Milk", "Atta"]);
  });
});
