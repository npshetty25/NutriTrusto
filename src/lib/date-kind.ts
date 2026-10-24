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
  // "BB" alone is checked with its own word boundaries via the leading space
  // or start, so "BBQ" is not read as a best-before mark.
  if (/best\s*before|(^|\s)b\.?b\.?e?(\s|:|$)/.test(text)) return "best_before";
  if (/use\s*by|exp(iry|ires|\.|:|\s)/.test(text)) return "use_by";
  return null;
}

export function asDateKind(value: unknown): DateKind | null {
  return value === "use_by" || value === "best_before" ? value : null;
}

/** What a card says once the printed date has passed. */
export function pastDateMessage(kind: DateKind | null): string | null {
  if (kind === "use_by") return "Past its use-by date. That is a safety date — don't eat it.";
  if (kind === "best_before") return "Past its best-before date. It may have lost quality but is not necessarily unsafe — look, smell and check before using.";
  return null;
}
