import fs from "node:fs/promises";
import path from "node:path";
import { getJobRawExtractDirectory } from "./artifact-paths.js";

function toSafeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export async function saveRawExtract(params: {
  jobId: string;
  label: string;
  payload: unknown;
}): Promise<string> {
  const directory = getJobRawExtractDirectory(params.jobId);
  await fs.mkdir(directory, { recursive: true });

  const fileName = `${Date.now()}-${toSafeFileName(params.label)}.json`;
  const filePath = path.join(directory, fileName);

  await fs.writeFile(filePath, JSON.stringify(params.payload, null, 2), "utf8");
  return filePath;
}
