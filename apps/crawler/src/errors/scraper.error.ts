export const BLOCKED_REASONS = [
  "LOGIN_WALL",
  "CAPTCHA",
  "TIMEOUT",
  "NETWORK_ERROR",
  "NO_HEARTBEAT",
  "EXTRACTION_LIMIT",
  "UNKNOWN",
] as const;

export type BlockedReason = (typeof BLOCKED_REASONS)[number];

export function isBlockedReason(value: unknown): value is BlockedReason {
  return (
    typeof value === "string" &&
    (BLOCKED_REASONS as readonly string[]).includes(value)
  );
}

export class ScraperError extends Error {
  readonly reason: BlockedReason;

  constructor(reason: BlockedReason, message: string) {
    super(message);
    this.name = "ScraperError";
    this.reason = reason;
  }
}
