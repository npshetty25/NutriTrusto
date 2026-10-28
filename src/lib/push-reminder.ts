import { filterByDiet, normalizeDietPreference } from "@/lib/diet";
import { remainingFor } from "@/lib/item-age";

/**
 * The morning reminder for one account: what to say, from the pantry rows it can
 * see. The same rules as the in-app reminder: the account's diet, the days of
 * warning it chose, and the last day included.
 */
export interface ReminderRow {
  name: string;
  days_left: number;
  purchase_date: string;
  expiry_date?: string | null;
  ingredients_text?: string | null;
}

export interface ReminderPrefs {
  notifications_enabled?: boolean;
  notify_days_before?: number;
  dietary_preference?: string;
}

export interface Reminder {
  title: string;
  body: string;
  /** Where tapping it goes. */
  url: string;
}

const NAMES_SHOWN = 4;

export function composeReminder(rows: ReminderRow[], prefs: ReminderPrefs, now: Date = new Date()): Reminder | null {
  if (prefs.notifications_enabled === false) return null;
  const within = Number.isFinite(Number(prefs.notify_days_before)) ? Number(prefs.notify_days_before) : 3;

  const visible = filterByDiet(
    normalizeDietPreference(prefs.dietary_preference),
    rows.map((r) => ({ ...r, ingredientsText: r.ingredients_text ?? null }))
  );
  const due = visible
    .map((r) => ({ name: r.name, ...remainingFor(r, now) }))
    // Within the warning window and not already past: past-date food is a "check it" matter, not a reminder to cook it.
    .filter((r) => r.daysPast === 0 && r.daysLeft <= within)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  if (due.length === 0) return null;

  const today = due.filter((r) => r.daysLeft === 0);
  const shown = due.slice(0, NAMES_SHOWN).map((r) => r.name).join(", ");
  const more = due.length > NAMES_SHOWN ? ` and ${due.length - NAMES_SHOWN} more` : "";
  return {
    title: today.length > 0 ? "Use these today" : "Eat these soon",
    body: `${shown}${more}${today.length > 0 ? ` (${today.length === due.length ? "last day" : `${today.length} on their last day`})` : ""}.`,
    url: "/",
  };
}
