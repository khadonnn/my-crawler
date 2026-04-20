import fs from "node:fs";
import Tesseract from "tesseract.js";
import { getJobRawExtractDirectory } from "./artifact-paths.js";
import { saveRawExtractWithFileName } from "./raw-extract.js";

export async function extractTextFromImage(
  imagePath: string,
  lang = "vie",
): Promise<string> {
  const result = await Tesseract.recognize(imagePath, lang);
  return result.data.text;
}

export async function saveOcrResultArtifact(params: {
  jobId: string;
  imagePath: string;
  extractedText: string;
}): Promise<string> {
  const directory = getJobRawExtractDirectory(params.jobId);
  fs.mkdirSync(directory, { recursive: true });

  const payload = {
    imagePath: params.imagePath,
    extractedText: params.extractedText,
    createdAt: new Date().toISOString(),
  };

  return saveRawExtractWithFileName({
    jobId: params.jobId,
    fileName: `${params.jobId}-ocr-result.json`,
    payload,
  });
}
