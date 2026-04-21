import { PlaywrightCrawler, ProxyConfiguration } from "crawlee";
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
import { ScraperError } from "../../errors/scraper.error.js";

const FAST_LOCAL_MODE = process.env.CRAWLER_FAST_LOCAL_MODE === "true";
const FB_SEARCH_HANDLER_TIMEOUT_SECS = FAST_LOCAL_MODE ? 30 : 45;
const FB_SEARCH_INPUT_WAIT_MS = FAST_LOCAL_MODE ? 6_000 : 12_000;
const FB_SEARCH_DOM_WAIT_MS = FAST_LOCAL_MODE ? 7_000 : 15_000;
const FB_SEARCH_SCROLL_DELAY_MS = FAST_LOCAL_MODE ? 700 : 1_500;
const FB_SEARCH_SCROLL_LOOPS = FAST_LOCAL_MODE ? 5 : 12;

export class FacebookSearchStrategy extends BaseScraper {
  readonly platform = "facebook";

  async execute(input: ScrapeExecutionInput): Promise<ScrapeExecutionOutput> {
    const keyword = input.keyword?.trim();
    if (!keyword) {
      throw new ScraperError("UNKNOWN", "SEARCH_KEYWORD requires keyword");
    }

    const scraper = this;

    const proxyConfiguration = input.proxy
      ? new ProxyConfiguration({ proxyUrls: [input.proxy.url] })
      : undefined;

    return new Promise<ScrapeExecutionOutput>((resolve, reject) => {
      const crawler = new PlaywrightCrawler({
        maxRequestsPerCrawl: 1,
        requestHandlerTimeoutSecs: FB_SEARCH_HANDLER_TIMEOUT_SECS,
        headless: true,
        proxyConfiguration,
        async requestHandler({ page }) {
          await page.goto("https://www.facebook.com", {
            waitUntil: "domcontentloaded",
          });

          if (page.url().toLowerCase().includes("login")) {
            throw new ScraperError(
              "LOGIN_WALL",
              "Facebook redirected to login before keyword search",
            );
          }

          const searchInput = page
            .locator(
              'input[aria-label*="Search"], input[placeholder*="Search"], input[type="search"]',
            )
            .first();
          try {
            await searchInput.waitFor({ timeout: FB_SEARCH_INPUT_WAIT_MS });
          } catch {
            throw new ScraperError(
              "TIMEOUT",
              "Search input selector timed out on Facebook",
            );
          }
          await searchInput.fill(keyword);
          await searchInput.press("Enter");

          await page.waitForLoadState("domcontentloaded", {
            timeout: FB_SEARCH_DOM_WAIT_MS,
          });

          for (let i = 0; i < FB_SEARCH_SCROLL_LOOPS; i += 1) {
            await page.mouse.wheel(0, 1_200);
            await page.waitForTimeout(FB_SEARCH_SCROLL_DELAY_MS);
          }

          if (input.debugMode) {
            const screenshotPath = await captureJobScreenshot({
              page,
              jobId: input.jobId,
              label: "facebook-search-result",
            });

            await saveRawExtract({
              jobId: input.jobId,
              label: "facebook-search-meta",
              payload: {
                keyword,
                currentUrl: page.url(),
                screenshotPath,
              },
            });
          }

          const title = await page.title();
          const bodyText = await page.locator("body").innerText();

          logJobEvent("info", {
            jobId: input.jobId,
            platform: "facebook",
            phase: "search",
            step: "keyword-search",
            message: "Facebook keyword search executed",
            meta: { keyword, currentUrl: page.url() },
          });

          resolve({
            url: page.url(),
            title,
            previewSnippet: scraper.createPreview(bodyText),
            crawledAt: new Date().toISOString(),
          });
        },
      });

      crawler.run(["https://www.facebook.com"]).catch(reject);
    });
  }
}
