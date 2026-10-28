import { describe, expect, it } from "vitest";
import { runReminders, type PushSub, type ReminderSender, type ReminderStore, type SendResult } from "./push-job";
import type { ReminderPrefs, ReminderRow } from "./push-reminder";

const NOW = new Date("2026-10-28T02:30:00Z");

const sub = (id: string, user: string): PushSub => ({ id, user_id: user, endpoint: `https://push.example/${id}`, p256dh: "k", auth: "a" });
const DUE: ReminderRow = { name: "Curd", days_left: 4, purchase_date: "2026-10-24" };
const FINE: ReminderRow = { name: "Rice", days_left: 200, purchase_date: "2026-10-20" };

function fake(opts: {
  subs: PushSub[];
  pantry?: Record<string, ReminderRow[]>;
  prefs?: Record<string, ReminderPrefs>;
  results?: Record<string, SendResult>;
  pantryThrowsFor?: string;
}) {
  const log = { sentTo: [] as string[], marked: [] as string[], removed: [] as string[], markDay: "" };
  const store: ReminderStore = {
    dueSubscriptions: async () => opts.subs,
    prefsFor: async (u) => opts.prefs?.[u] ?? {},
    pantryFor: async (u) => {
      if (u === opts.pantryThrowsFor) throw new Error("boom");
      return opts.pantry?.[u] ?? [];
    },
    markSent: async (ids, day) => { log.marked.push(...ids); log.markDay = day; },
    remove: async (ids) => { log.removed.push(...ids); },
  };
  const sender: ReminderSender = {
    send: async (s) => { log.sentTo.push(s.id); return opts.results?.[s.id] ?? "ok"; },
  };
  return { store, sender, log };
}

describe("runReminders", () => {
  it("sends each person with something due one reminder per device, and marks them sent today", async () => {
    const f = fake({ subs: [sub("s1", "a"), sub("s2", "a"), sub("s3", "b")], pantry: { a: [DUE], b: [DUE] } });
    const summary = await runReminders(f.store, f.sender, NOW);
    expect(f.log.sentTo).toEqual(["s1", "s2", "s3"]);
    expect(f.log.marked).toEqual(["s1", "s2", "s3"]);
    expect(f.log.markDay).toBe("2026-10-28");
    expect(summary).toEqual({ users: 2, sent: 3, removed: 0, failed: 0, quiet: 0 });
  });

  it("says nothing to someone with nothing due, and does not mark them, so tomorrow can still reach them", async () => {
    const f = fake({ subs: [sub("s1", "a")], pantry: { a: [FINE] } });
    const summary = await runReminders(f.store, f.sender, NOW);
    expect(f.log.sentTo).toEqual([]);
    expect(f.log.marked).toEqual([]);
    expect(summary.quiet).toBe(1);
  });

  it("respects an account that switched reminders off", async () => {
    const f = fake({ subs: [sub("s1", "a")], pantry: { a: [DUE] }, prefs: { a: { notifications_enabled: false } } });
    await runReminders(f.store, f.sender, NOW);
    expect(f.log.sentTo).toEqual([]);
  });

  it("deletes a subscription the push service says is gone, and keeps one that merely failed", async () => {
    const f = fake({
      subs: [sub("s1", "a"), sub("s2", "a"), sub("s3", "a")],
      pantry: { a: [DUE] },
      results: { s1: "gone", s2: "error" },
    });
    const summary = await runReminders(f.store, f.sender, NOW);
    expect(f.log.removed).toEqual(["s1"]);
    expect(f.log.marked).toEqual(["s3"]);
    expect(summary).toMatchObject({ sent: 1, removed: 1, failed: 1 });
  });

  it("one person's unreadable pantry does not stop everyone else", async () => {
    const f = fake({ subs: [sub("s1", "a"), sub("s2", "b")], pantry: { b: [DUE] }, pantryThrowsFor: "a" });
    const summary = await runReminders(f.store, f.sender, NOW);
    expect(f.log.sentTo).toEqual(["s2"]);
    expect(summary).toMatchObject({ sent: 1, failed: 1 });
  });

  it("does nothing, and sends nothing, when no one has subscribed", async () => {
    const f = fake({ subs: [] });
    expect(await runReminders(f.store, f.sender, NOW)).toEqual({ users: 0, sent: 0, removed: 0, failed: 0, quiet: 0 });
  });
});
