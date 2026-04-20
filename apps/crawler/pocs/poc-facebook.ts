import { PlaywrightCrawler } from "crawlee";
import {
  extractTextFromImage,
  saveOcrResultArtifact,
} from "../src/observability/ocr.js";
import { captureJobScreenshot } from "../src/observability/screenshot.js";

async function run(): Promise<void> {
  const targetUrl = process.argv[2];

  if (!targetUrl) {
    console.error(
      "Usage: npm run poc:facebook -- <facebook-group-or-post-url>",
    );
    process.exit(1);
  }

  const crawler = new PlaywrightCrawler({
    headless: true,
    maxRequestsPerCrawl: 1,
    async requestHandler({ page, request, log }) {
      log.info(`POC start: ${request.loadedUrl}`);
      const jobId = `poc-facebook-${Date.now()}`;

      for (let i = 0; i < 3; i += 1) {
        await page.mouse.wheel(0, 2500);
        await page.waitForTimeout(1200);
      }

      const afterScrollScreenshotPath = await captureJobScreenshot({
        page,
        jobId,
        label: "after-scroll",
      });

      const ocrText = await extractTextFromImage(
        afterScrollScreenshotPath,
        "vie",
      );
      console.log("OCR text:", ocrText);

      const ocrArtifactPath = await saveOcrResultArtifact({
        jobId,
        imagePath: afterScrollScreenshotPath,
        extractedText: ocrText,
      });
      console.log("OCR artifact:", ocrArtifactPath);

      const title = await page.title();
      const preview = (await page.locator("body").innerText())
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500);

      console.log({
        title,
        preview,
        url: request.loadedUrl,
        timestamp: new Date().toISOString(),
      });
    },
  });

  await crawler.run([targetUrl]);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
