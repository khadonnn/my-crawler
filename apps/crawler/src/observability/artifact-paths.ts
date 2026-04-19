import path from "node:path";

const STORAGE_ROOT = path.resolve(process.cwd(), "storage");

export function getJobArtifactDirectory(jobId: string): string {
  return path.join(STORAGE_ROOT, jobId);
}

export function getJobScreenshotDirectory(jobId: string): string {
  return path.join(getJobArtifactDirectory(jobId), "screenshots");
}

export function getJobRawExtractDirectory(jobId: string): string {
  return path.join(getJobArtifactDirectory(jobId), "raw-extracts");
}
