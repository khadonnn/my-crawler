import { PlaywrightCrawler, ProxyConfiguration } from "crawlee";
import type { Page } from "playwright";
import { BaseScraper } from "../base/base.scraper.js";
import type {
  ScrapeExecutionInput,
  ScrapeOptions,
  ScrapeExecutionOutput,
} from "../base/scraper.types.js";
import { FacebookDirectStrategy } from "./facebook-direct.scraper.js";
import {
  captureJobScreenshot,
  logJobEvent,
  saveRawExtract,
} from "../../observability/index.js";
import { ScraperError } from "../../errors/scraper.error.js";
import {
  closeBrowserSafely,
  enforceProxyRequired,
  verifyProxyEgressIp,
} from "../base/proxy-safety.js";

const FAST_LOCAL_MODE = process.env.CRAWLER_FAST_LOCAL_MODE === "true";
const FB_SEARCH_HANDLER_TIMEOUT_SECS = FAST_LOCAL_MODE ? 45 : 60;
const FB_SEARCH_DOM_WAIT_MS = FAST_LOCAL_MODE ? 7_000 : 15_000;
const FB_SEARCH_SCROLL_DELAY_MS = FAST_LOCAL_MODE ? 700 : 1_500;
const FB_SEARCH_MAX_SCROLL = 2;
const FB_SEARCH_MAX_POST_LINKS = 5;

function normalizeFacebookPostUrl(rawHref: string): string | null {
  let url: URL;

  try {
    url = new URL(rawHref, "https://www.facebook.com");
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!host.endsWith("facebook.com")) {
    return null;
  }

  const pathname = url.pathname.toLowerCase();
  const allowedPatterns = [
    "/posts/",
    "/permalink.php",
    "/story.php",
    "/videos/",
    "/reel/",
    "/photo.php",
  ];

  if (!allowedPatterns.some((pattern) => pathname.includes(pattern))) {
    return null;
  }

  if (pathname.includes("/permalink.php") || pathname.includes("/story.php")) {
    const normalized = new URL(url.toString());
    const allowedQueryKeys = new Set(["id", "story_fbid"]);

    for (const key of [...normalized.searchParams.keys()]) {
      if (!allowedQueryKeys.has(key)) {
        normalized.searchParams.delete(key);
      }
    }

    return normalized.toString();
  }

  return `${url.origin}${url.pathname}`;
}

async function collectFacebookPostUrls(page: Page): Promise<string[]> {
  const discoveredUrls = new Set<string>();

  for (
    let scrollIndex = 0;
    scrollIndex < FB_SEARCH_MAX_SCROLL;
    scrollIndex += 1
  ) {
    if (scrollIndex > 0) {
      await page.mouse.wheel(0, 1_200);
      await page.waitForTimeout(FB_SEARCH_SCROLL_DELAY_MS);
    }

    const candidates = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).map(
        (anchor) => (anchor as HTMLAnchorElement).href,
      ),
    );

    for (const candidate of candidates) {
      const normalized = normalizeFacebookPostUrl(candidate);

      if (normalized) {
        discoveredUrls.add(normalized);
      }
    }
  }

  return [...discoveredUrls].slice(0, FB_SEARCH_MAX_POST_LINKS);
}

export class FacebookSearchStrategy extends BaseScraper {
  readonly platform = "facebook";

  async execute(
    input: ScrapeExecutionInput,
    options?: ScrapeOptions,
  ): Promise<ScrapeExecutionOutput> {
    enforceProxyRequired(input.proxy);

    const keyword = input.keyword?.trim();
    if (!keyword) {
      throw new ScraperError("UNKNOWN", "SEARCH_KEYWORD requires keyword");
    }

    const scraper = this;
    const directStrategy = new FacebookDirectStrategy();
    const resumeIndex = Math.max(0, Math.floor(input.searchStartIndex ?? 0));

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
          try {
            if (!input.proxy) {
              throw new ScraperError(
                "PROXY_REQUIRED",
                "System requires proxy but none was provided",
              );
            }

            logJobEvent("info", {
              jobId: input.jobId,
              platform: "facebook",
              phase: "proxy",
              step: "browser-launched-with-proxy",
              message: "Browser launched with proxy for search",
              meta: {
                proxyServer: `${input.proxy.ip}:${input.proxy.port}`,
              },
            });

            await verifyProxyEgressIp({
              page,
              jobId: input.jobId,
              platform: "facebook",
              proxy: input.proxy,
            });

            const searchUrl = `https://www.facebook.com/search/posts/?q=${encodeURIComponent(keyword)}`;

            await page.goto(searchUrl, {
              waitUntil: "domcontentloaded",
            });

            if (page.url().toLowerCase().includes("login")) {
              throw new ScraperError(
                "LOGIN_WALL",
                "Facebook redirected to login before keyword search",
              );
            }

            await page.waitForLoadState("domcontentloaded", {
              timeout: FB_SEARCH_DOM_WAIT_MS,
            });

            const postUrls = await collectFacebookPostUrls(page);
            await input.onProgress?.(20, "search-phase-complete");

            const safeStartIndex = Math.min(resumeIndex, postUrls.length);
            if (safeStartIndex > 0) {
              logJobEvent("info", {
                jobId: input.jobId,
                platform: "facebook",
                phase: "search",
                step: "search-resume-from-checkpoint",
                message: "Resuming search crawl from checkpoint index",
                meta: {
                  resumeIndex: safeStartIndex,
                  total: postUrls.length,
                },
              });
            }

            let processedCount = 0;
            let failedCount = 0;

            for (
              let index = safeStartIndex;
              index < postUrls.length;
              index += 1
            ) {
              const postUrl = postUrls[index];
              logJobEvent("info", {
                jobId: input.jobId,
                platform: "facebook",
                phase: "search",
                step: "search-crawl-start",
                message: "Starting crawl for discovered URL",
                meta: {
                  keyword,
                  url: postUrl,
                  index,
                  total: postUrls.length,
                },
              });

              try {
                const result = await directStrategy.execute({
                  jobId: input.jobId,
                  platform: input.platform,
                  mode: "DIRECT_URL",
                  url: postUrl,
                  keyword,
                  debugMode: input.debugMode,
                  proxy: input.proxy,
                });

                await options?.onPartialResult?.(result, {
                  url: postUrl,
                  index,
                  total: postUrls.length,
                });

                processedCount += 1;
                logJobEvent("info", {
                  jobId: input.jobId,
                  platform: "facebook",
                  phase: "search",
                  step: "search-crawl-success",
                  message: "Finished crawl for discovered URL",
                  meta: {
                    keyword,
                    url: postUrl,
                    index,
                    total: postUrls.length,
                  },
                });
              } catch (error) {
                failedCount += 1;
                logJobEvent("warn", {
                  jobId: input.jobId,
                  platform: "facebook",
                  phase: "search",
                  step: "search-crawl-error",
                  message: "Skipped failed Facebook search result URL",
                  meta: {
                    keyword,
                    url: postUrl,
                    index,
                    total: postUrls.length,
                    error: error instanceof Error ? error.message : "unknown",
                  },
                });
              }
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
              meta: {
                keyword,
                currentUrl: page.url(),
                discoveredUrls: postUrls.length,
                crawledPosts: processedCount,
                failedCount,
              },
            });

            resolve({
              url: page.url(),
              title,
              previewSnippet: scraper.createPreview(bodyText),
              crawledAt: new Date().toISOString(),
              summary: {
                success: failedCount === 0,
                totalProcessed: processedCount,
                totalDiscovered: postUrls.length,
                failedCount,
              },
            });
          } catch (error) {
            await closeBrowserSafely(page);
            throw error;
          }
        },
      });

      crawler.run(["https://www.facebook.com"]).catch(reject);
    });
  }
}
