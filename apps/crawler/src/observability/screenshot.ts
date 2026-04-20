import fs from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import { getJobScreenshotDirectory } from "./artifact-paths.js";

function toSafeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export async function captureJobScreenshot(params: {
  page: Page;
  jobId: string;
  label: string;
}): Promise<string> {
  const directory = getJobScreenshotDirectory(params.jobId);
  fs.mkdirSync(directory, { recursive: true });

  const fileName = `${Date.now()}-${toSafeFileName(params.label)}.png`;
  const filePath = path.join(directory, fileName);

  await params.page.screenshot({
    path: filePath,
    fullPage: true,
  });

  return filePath;
}
