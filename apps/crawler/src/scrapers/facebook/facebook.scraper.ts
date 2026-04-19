import { PlaywrightCrawler } from "crawlee";
import { BaseScraper } from "../base/base.scraper.js";
import type {
  ScrapeExecutionInput,
  ScrapeExecutionOutput,
} from "../base/scraper.types.js";
import { FACEBOOK_SELECTORS } from "./facebook.selectors.js";
import {
  captureJobScreenshot,
  logJobEvent,
  saveRawExtract,
} from "../../observability/index.js";

export class FacebookScraper extends BaseScraper {
  readonly platform = "facebook";

  async execute(input: ScrapeExecutionInput): Promise<ScrapeExecutionOutput> {
    const scraper = this;

    return new Promise<ScrapeExecutionOutput>((resolve, reject) => {
      const crawler = new PlaywrightCrawler({
        browserPoolOptions: {
          retireBrowserAfterPageCount: 10,
        },
        maxRequestsPerCrawl: 1,
        requestHandlerTimeoutSecs: 45,
        headless: true,
        async requestHandler({ page, request, log }) {
          logJobEvent("info", {
            jobId: input.jobId,
            platform: "facebook",
            phase: "navigate",
            step: "open-url",
            message: "Opening target URL",
            meta: { url: request.loadedUrl ?? input.url },
          });
          log.info(`[${input.jobId}][facebook] Crawling: ${request.loadedUrl}`);

          try {
            await page.waitForLoadState("networkidle", { timeout: 15000 });
          } catch {
            await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
          }

          if (input.debugMode) {
            const screenshotPath = await captureJobScreenshot({
              page,
              jobId: input.jobId,
              label: "facebook-loaded",
            });

            logJobEvent("info", {
              jobId: input.jobId,
              platform: "facebook",
              phase: "observe",
              step: "screenshot",
              message: "Captured debug screenshot",
              meta: { screenshotPath },
            });
          }

          const title = await page.title();
          const feedExists =
            (await page.locator(FACEBOOK_SELECTORS.feedRoot).count()) > 0;
          const rawText = await page
            .locator(FACEBOOK_SELECTORS.fallbackBody)
            .innerText();

          if (input.debugMode) {
            const rawExtractPath = await saveRawExtract({
              jobId: input.jobId,
              label: "facebook-body",
              payload: {
                url: request.loadedUrl ?? input.url,
                title,
                feedExists,
                rawText,
              },
            });

            logJobEvent("info", {
              jobId: input.jobId,
              platform: "facebook",
              phase: "observe",
              step: "raw-extract",
              message: "Saved raw extract snapshot",
              meta: { rawExtractPath },
            });
          }

          resolve({
            url: request.loadedUrl ?? input.url,
            title: feedExists ? `[Feed] ${title}` : title,
            previewSnippet: scraper.createPreview(rawText),
            crawledAt: new Date().toISOString(),
          });
        },
      });

      crawler.run([input.url]).catch(reject);
    });
  }
}
