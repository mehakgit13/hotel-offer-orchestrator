type Level = "info" | "warn" | "error";

function write(level: Level, message: string, meta?: unknown): void {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta === undefined ? {} : { meta })
  };
  const output = JSON.stringify(record);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}

export const logger = {
  info: (message: string, meta?: unknown) => write("info", message, meta),
  warn: (message: string, meta?: unknown) => write("warn", message, meta),
  error: (message: string, meta?: unknown) => write("error", message, meta)
};
