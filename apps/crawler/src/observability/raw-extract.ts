import fs from "node:fs";
import fsp from "node:fs/promises";
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
  fs.mkdirSync(directory, { recursive: true });

  const fileName = `${Date.now()}-${toSafeFileName(params.label)}.json`;
  const filePath = path.join(directory, fileName);

  await fsp.writeFile(
    filePath,
    JSON.stringify(params.payload, null, 2),
    "utf8",
  );
  return filePath;
}

export async function saveRawExtractWithFileName(params: {
  jobId: string;
  fileName: string;
  payload: unknown;
}): Promise<string> {
  const directory = getJobRawExtractDirectory(params.jobId);
  fs.mkdirSync(directory, { recursive: true });

  const filePath = path.join(directory, params.fileName);
  await fsp.writeFile(
    filePath,
    JSON.stringify(params.payload, null, 2),
    "utf8",
  );
  return filePath;
}
