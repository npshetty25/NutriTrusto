const MAX_ITEMS = 20;

/** Names only, cleaned: the model's text is never trusted as-is. */
export function cleanNames(raw: unknown): string[] {
  const list = Array.isArray((raw as { items?: unknown })?.items) ? ((raw as { items: unknown[] }).items) : [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const entry of list) {
    const value = typeof entry === "string" ? entry : (entry as { name?: unknown })?.name;
    if (typeof value !== "string") continue;
    const name = value.replace(/\s+/g, " ").trim().slice(0, 60);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length === MAX_ITEMS) break;
  }
  return names;
}
