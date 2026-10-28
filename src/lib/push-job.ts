import { composeReminder, type Reminder, type ReminderPrefs, type ReminderRow } from "@/lib/push-reminder";

export interface PushSub {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** What the job needs from the database; the route supplies the real one, tests a fake. */
export interface ReminderStore {
  /** Subscriptions that have not been sent today's reminder. */
  dueSubscriptions(today: string): Promise<PushSub[]>;
  prefsFor(userId: string): Promise<ReminderPrefs>;
  /** Everything the person can see: their own items and their household's. */
  pantryFor(userId: string): Promise<ReminderRow[]>;
  markSent(ids: string[], today: string): Promise<void>;
  remove(ids: string[]): Promise<void>;
}

export type SendResult = "ok" | "gone" | "error";
export interface ReminderSender {
  send(sub: PushSub, reminder: Reminder): Promise<SendResult>;
}

export interface JobSummary {
  users: number;
  sent: number;
  /** Subscriptions the push service said no longer exist; deleted. */
  removed: number;
  /** Failed sends; kept, and tried again tomorrow. */
  failed: number;
  /** People with nothing due, or reminders switched off. */
  quiet: number;
}

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * One pass of the morning job. A person with nothing due gets nothing and is
 * not marked, so a pantry that fills later in the day is covered tomorrow, and a
 * send that fails is not marked either. A reminder goes to a browser at most once
 * a day, even if the job runs twice.
 */
export async function runReminders(store: ReminderStore, sender: ReminderSender, now: Date = new Date()): Promise<JobSummary> {
  const today = dayOf(now);
  const summary: JobSummary = { users: 0, sent: 0, removed: 0, failed: 0, quiet: 0 };

  const byUser = new Map<string, PushSub[]>();
  for (const sub of await store.dueSubscriptions(today)) {
    byUser.set(sub.user_id, [...(byUser.get(sub.user_id) ?? []), sub]);
  }

  for (const [userId, subs] of byUser) {
    summary.users += 1;
    let reminder: Reminder | null = null;
    try {
      reminder = composeReminder(await store.pantryFor(userId), await store.prefsFor(userId), now);
    } catch {
      // One person's unreadable pantry must not stop everyone else's reminder.
      summary.failed += subs.length;
      continue;
    }
    if (!reminder) {
      summary.quiet += 1;
      continue;
    }

    const sent: string[] = [];
    const gone: string[] = [];
    for (const sub of subs) {
      const result = await sender.send(sub, reminder);
      if (result === "ok") sent.push(sub.id);
      else if (result === "gone") gone.push(sub.id);
      else summary.failed += 1;
    }
    if (sent.length) await store.markSent(sent, today);
    if (gone.length) await store.remove(gone);
    summary.sent += sent.length;
    summary.removed += gone.length;
  }
  return summary;
}
