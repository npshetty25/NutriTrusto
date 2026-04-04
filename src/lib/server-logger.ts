export type LogLevel = "info" | "warn" | "error";

const nowIso = () => new Date().toISOString();

const safeStringify = (data?: Record<string, unknown>) => {
  if (!data) return "";
  try {
    return JSON.stringify(data);
  } catch {
    return '[unserializable-meta]';
  }
};

export const createRequestContext = (route: string) => {
  const startedAt = Date.now();
  const requestId = `${route}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    const durationMs = Date.now() - startedAt;
    const base = `[${nowIso()}] [${level.toUpperCase()}] [${route}] [${requestId}] ${message} (+${durationMs}ms)`;
    const payload = safeStringify(meta);

    if (level === "error") {
      console.error(payload ? `${base} ${payload}` : base);
      return;
    }

    if (level === "warn") {
      console.warn(payload ? `${base} ${payload}` : base);
      return;
    }

    console.info(payload ? `${base} ${payload}` : base);
  };

  return {
    requestId,
    info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
  };
};
