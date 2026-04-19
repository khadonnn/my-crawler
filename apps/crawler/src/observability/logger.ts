export type LogLevel = "info" | "warn" | "error";

export interface JobLogContext {
  jobId: string;
  platform: string;
  phase: string;
  step: string;
  message: string;
  meta?: Record<string, unknown>;
}

function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) {
    return "";
  }

  return ` ${JSON.stringify(meta)}`;
}

export function logJobEvent(level: LogLevel, context: JobLogContext): void {
  const prefix = `[${context.jobId}][${context.platform}][${context.phase}][${context.step}]`;
  const suffix = formatMeta(context.meta);

  if (level === "error") {
    console.error(`${prefix} ${context.message}${suffix}`);
    return;
  }

  if (level === "warn") {
    console.warn(`${prefix} ${context.message}${suffix}`);
    return;
  }

  console.log(`${prefix} ${context.message}${suffix}`);
}
