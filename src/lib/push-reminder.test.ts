import { describe, expect, it } from "vitest";
import { composeReminder, type ReminderRow } from "./push-reminder";

const now = new Date(2026, 9, 28, 8, 0);
const row = (name: string, days_left: number, bought: string, over: Partial<ReminderRow> = {}): ReminderRow => ({ name, days_left, purchase_date: bought, ...over });

describe("composeReminder", () => {
  it("lists what is within the warning window, soonest first, and says when it is the last day", () => {
    const r = composeReminder(
      [row("Spinach", 4, "2026-10-26"), row("Paneer", 3, "2026-10-28"), row("Rice", 200, "2026-10-20"), row("Curd", 4, "2026-10-24")],
      { notify_days_before: 3 },
      now
    );
    expect(r).toMatchObject({ title: "Use these today", url: "/" });
    expect(r?.body).toBe("Curd, Spinach, Paneer (1 on their last day).");
  });

  it("says 'last day' when everything is", () => {
    expect(composeReminder([row("Curd", 4, "2026-10-24")], {}, now)?.body).toBe("Curd (last day).");
  });

  it("is a gentler 'eat soon' when nothing is due today", () => {
    expect(composeReminder([row("Paneer", 3, "2026-10-27")], { notify_days_before: 3 }, now)).toMatchObject({ title: "Eat these soon", body: "Paneer." });
  });

  it("says nothing when nothing is due", () => {
    expect(composeReminder([row("Rice", 200, "2026-10-20")], {}, now)).toBeNull();
    expect(composeReminder([], {}, now)).toBeNull();
  });

  it("never reminds about food already past its date, which is for checking, not cooking", () => {
    expect(composeReminder([row("Old curd", 2, "2026-10-20")], {}, now)).toBeNull();
  });

  it("respects the account having switched reminders off", () => {
    expect(composeReminder([row("Curd", 4, "2026-10-24")], { notifications_enabled: false }, now)).toBeNull();
  });

  it("uses the days of warning the account chose", () => {
    const rows = [row("Paneer", 5, "2026-10-28")];
    expect(composeReminder(rows, { notify_days_before: 3 }, now)).toBeNull();
    expect(composeReminder(rows, { notify_days_before: 7 }, now)).not.toBeNull();
  });

  it("keeps to the diet: a vegetarian is never told about the eggs", () => {
    const r = composeReminder([row("Eggs", 4, "2026-10-24"), row("Paneer", 4, "2026-10-24")], { dietary_preference: "veg" }, now);
    expect(r?.body).toBe("Paneer (last day).");
  });

  it("counts from the pack's own date when it has one", () => {
    const r = composeReminder([row("Milk", 0, "2026-10-28", { expiry_date: "2026-10-29" })], {}, now);
    expect(r).toMatchObject({ title: "Eat these soon", body: "Milk." });
  });

  it("names four and counts the rest", () => {
    const rows = ["A1", "B2", "C3", "D4", "E5", "F6"].map((n) => row(`Item ${n}`, 4, "2026-10-26"));
    expect(composeReminder(rows, {}, now)?.body).toMatch(/and 2 more/);
  });
});
