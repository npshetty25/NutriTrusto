/**
 * Which kind of date a pack printed.
 *
 * FSSAI's Packaging and Labelling Regulations define both, and they mean
 * different things:
 *   use_by       a safety date — after it, the food should not be eaten
 *   best_before  a quality date — after it, the food may be past its best
 *                but is not necessarily unsafe
 *
 * The app used to treat every printed date as the same kind of deadline. The
 * scan route asks the model which one it saw, and the printed excerpt is
 * checked here as a backstop.
 */
export type DateKind = "use_by" | "best_before";

export function resolveDateKind(modelKind: unknown, rawText: unknown): DateKind | null {
  if (modelKind === "use_by" || modelKind === "best_before") return modelKind;
  const text = typeof rawText === "string" ? rawText.toLowerCase() : "";
  // FSSAI's own abbreviations (FAQ on the 2020 regulations, Q19): BB, BBD for
  // best before; UB, UBD, EXD, ED for use-by and expiry. Each is checked on
  // its own word boundaries, so "BBQ" or the "ed" in "packed" is not a mark.
  if (/best\s*before|(^|[^a-z])b\.?b\.?(e|d)?\.?(\s|:|$)/.test(text)) return "best_before";
  if (/use\s*by|exp(iry|ires|\.|:|\s|$)|(^|[^a-z])(u\.?b\.?d?|ex\.?d|e\.?d)\.?(\s|:|$)/.test(text)) return "use_by";
  return null;
}

export function asDateKind(value: unknown): DateKind | null {
  return value === "use_by" || value === "best_before" ? value : null;
}

/**
 * What a card says once the date has passed. `fromPack` is true when the
 * date came from the pack or the person rather than our estimate, so an
 * unknown kind still gets advice that covers both readings of the date.
 */
export function pastDateMessage(kind: DateKind | null, fromPack = false): string | null {
  if (kind === "use_by") return "Past its use-by date. That is a safety date — don't eat it.";
  if (kind === "best_before") return "Past its best-before date. It may have lost quality but is not necessarily unsafe — look, smell and check before using.";
  if (fromPack) return "Past the date on the pack. If the pack says use by or expiry, don't eat it; if it says best before, look, smell and check first.";
  return null;
}

export type DateOrigin = "printed" | "user" | null;

/**
 * What the date on a card is called. "Use by" is a safety claim under FSSAI's
 * definitions, so it is only ever used for a date that IS a use-by; our own
 * estimate says it is one.
 */
export function dateLabel(kind: DateKind | null, origin: DateOrigin): string {
  if (kind === "use_by") return "Use by";
  if (kind === "best_before") return "Best before";
  if (origin === "printed") return "Date on pack";
  if (origin === "user") return "Your date";
  return "Good till about";
}

/**
 * The line under an item's name: "Best before 31 Oct", "Use by today",
 * "Our estimate ran out 24 Oct, 3 days ago". The day itself is not past: a
 * best-before of 31 October is still within its date on 31 October.
 */
export function dueLine(opts: { kind: DateKind | null; origin: DateOrigin; date: string; daysLeft: number; daysPast: number }): string {
  const { kind, origin, date, daysLeft, daysPast } = opts;
  const label = dateLabel(kind, origin);
  if (daysPast > 0) {
    const ago = `${daysPast} ${daysPast === 1 ? "day" : "days"} ago`;
    return origin || kind ? `${label} ${date}, ${ago}` : `Our estimate ran out ${date}, ${ago}`;
  }
  if (daysLeft <= 0) return origin || kind ? `${label} today` : "Our estimate runs out today";
  return `${label} ${date}`;
}
