export type LogLevel = "info" | "warn" | "error";

const nowIso = () => new Date().toISOString();

/**
 * One JSON object per line, so a log drain (Vercel, Azure Monitor, Loki) can
 * index fields instead of regex-parsing text. `level`, `route` and `requestId`
 * are always present; anything passed as `meta` is nested under `meta` so a
 * caller's key can never overwrite one of the reserved fields.
 */
export const createRequestContext = (route: string) => {
  const startedAt = Date.now();
  const requestId = `${route}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    const entry: Record<string, unknown> = {
      ts: nowIso(),
      level,
      route,
      requestId,
      msg: message,
      durationMs: Date.now() - startedAt,
    };
    if (meta) entry.meta = meta;

    let line: string;
    try {
      line = JSON.stringify(entry);
    } catch {
      // A circular or BigInt value in meta must not lose the log line itself.
      line = JSON.stringify({ ...entry, meta: "[unserializable]" });
    }

    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.info(line);
  };

  return {
    requestId,
    info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
  };
};
