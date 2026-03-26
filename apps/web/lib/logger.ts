type LogFields = Record<string, unknown>;

function emit(
  level: "info" | "warn" | "error",
  event: string,
  fields: LogFields,
): void {
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Structured JSON logs for Vercel / log drains (requestId, runId, etc.). */
export const log = {
  info(event: string, fields: LogFields = {}) {
    emit("info", event, fields);
  },
  warn(event: string, fields: LogFields = {}) {
    emit("warn", event, fields);
  },
  error(event: string, fields: LogFields = {}) {
    emit("error", event, fields);
  },
};
