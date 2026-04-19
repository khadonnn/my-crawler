import { PlaywrightCrawler } from "crawlee";
import { BaseScraper } from "../base/base.scraper.js";
import type {
  ScrapeExecutionInput,
  ScrapeExecutionOutput,
} from "../base/scraper.types.js";
import {
  captureJobScreenshot,
  logJobEvent,
  saveRawExtract,
} from "../../observability/index.js";

export class GenericScraper extends BaseScraper {
  readonly platform = "generic";

  async execute(input: ScrapeExecutionInput): Promise<ScrapeExecutionOutput> {
    const scraper = this;

    return new Promise<ScrapeExecutionOutput>((resolve, reject) => {
      const crawler = new PlaywrightCrawler({
        browserPoolOptions: {
          retireBrowserAfterPageCount: 10,
        },
        maxRequestsPerCrawl: 1,
        requestHandlerTimeoutSecs: 30,
        headless: true,
        async requestHandler({ page, request, log }) {
          logJobEvent("info", {
            jobId: input.jobId,
            platform: "generic",
            phase: "navigate",
            step: "open-url",
            message: "Opening target URL",
            meta: { url: request.loadedUrl ?? input.url },
          });
          log.info(`[${input.jobId}][generic] Crawling: ${request.loadedUrl}`);

          await page.waitForLoadState("networkidle", { timeout: 15000 });

          if (input.debugMode) {
            const screenshotPath = await captureJobScreenshot({
              page,
              jobId: input.jobId,
              label: "generic-loaded",
            });

            logJobEvent("info", {
              jobId: input.jobId,
              platform: "generic",
              phase: "observe",
              step: "screenshot",
              message: "Captured debug screenshot",
              meta: { screenshotPath },
            });
          }

          const title = await page.title();
          const content = await page.locator("body").innerText();

          if (input.debugMode) {
            const rawExtractPath = await saveRawExtract({
              jobId: input.jobId,
              label: "generic-body",
              payload: {
                url: request.loadedUrl ?? input.url,
                title,
                content,
              },
            });

            logJobEvent("info", {
              jobId: input.jobId,
              platform: "generic",
              phase: "observe",
              step: "raw-extract",
              message: "Saved raw extract snapshot",
              meta: { rawExtractPath },
            });
          }

          resolve({
            url: request.loadedUrl ?? input.url,
            title,
            previewSnippet: scraper.createPreview(content),
            crawledAt: new Date().toISOString(),
          });
        },
      });

      crawler.run([input.url]).catch(reject);
    });
  }
}
