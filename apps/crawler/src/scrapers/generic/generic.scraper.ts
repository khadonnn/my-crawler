import { PlaywrightCrawler, ProxyConfiguration } from "crawlee";
import { BaseScraper } from "../base/base.scraper.js";
import type {
  ScrapeExecutionInput,
  ScrapeOptions,
  ScrapeExecutionOutput,
} from "../base/scraper.types.js";
import {
  closeBrowserSafely,
  enforceProxyRequired,
  verifyProxyEgressIp,
} from "../base/proxy-safety.js";
import { ScraperError } from "../../errors/scraper.error.js";
import {
  captureJobScreenshot,
  logJobEvent,
  saveRawExtract,
} from "../../observability/index.js";

export class GenericScraper extends BaseScraper {
  readonly platform = "generic";

  async execute(
    input: ScrapeExecutionInput,
    _options?: ScrapeOptions,
  ): Promise<ScrapeExecutionOutput> {
    enforceProxyRequired(input.proxy);

    const targetUrl = input.url?.trim();
    if (!targetUrl) {
      throw new Error("DIRECT_URL requires url");
    }

    const scraper = this;
    const proxyConfiguration = input.proxy
      ? new ProxyConfiguration({ proxyUrls: [input.proxy.url] })
      : undefined;

    return new Promise<ScrapeExecutionOutput>((resolve, reject) => {
      const crawler = new PlaywrightCrawler({
        browserPoolOptions: {
          retireBrowserAfterPageCount: 10,
        },
        maxRequestsPerCrawl: 1,
        requestHandlerTimeoutSecs: 30,
        headless: true,
        proxyConfiguration,
        async requestHandler({ page, request, log }) {
          try {
            if (!input.proxy) {
              throw new ScraperError(
                "PROXY_REQUIRED",
                "System requires proxy but none was provided",
              );
            }

            logJobEvent("info", {
              jobId: input.jobId,
              platform: "generic",
              phase: "proxy",
              step: "browser-launched-with-proxy",
              message: "Browser launched with proxy",
              meta: {
                proxyServer: `${input.proxy.ip}:${input.proxy.port}`,
              },
            });

            await verifyProxyEgressIp({
              page,
              jobId: input.jobId,
              platform: "generic",
              proxy: input.proxy,
            });

            logJobEvent("info", {
              jobId: input.jobId,
              platform: "generic",
              phase: "navigate",
              step: "open-url",
              message: "Opening target URL",
              meta: {
                url: request.loadedUrl ?? targetUrl,
                proxy: {
                  address: input.proxy.address,
                  port: input.proxy.port,
                  region: input.proxy.region,
                },
              },
            });
            log.info(
              `[${input.jobId}][generic] Crawling: ${request.loadedUrl}`,
            );

            await page.goto(request.loadedUrl ?? targetUrl, {
              waitUntil: "domcontentloaded",
            });
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
                  url: request.loadedUrl ?? targetUrl,
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
              url: request.loadedUrl ?? targetUrl,
              title,
              previewSnippet: scraper.createPreview(content),
              crawledAt: new Date().toISOString(),
            });
          } catch (error) {
            await closeBrowserSafely(page);
            throw error;
          }
        },
      });

      crawler.run([targetUrl]).catch(reject);
    });
  }
}
