export type JobSourceType = "GROUP_URL" | "KEYWORD";
export type JobStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export * from "./types/scraper.js";
