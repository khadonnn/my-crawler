import { PlaywrightCrawler, ProxyConfiguration } from "crawlee";
import { getPrisma } from "@scraping-platform/db";
import type { Page } from "playwright";
import { BaseScraper } from "../base/base.scraper.js";
import type {
  ScrapedEntities,
  ScrapedInteractionEntity,
  ScrapedPostEntity,
  ScrapedProfileEntity,
  ScrapeExecutionInput,
  ScrapeOptions,
  ScrapeExecutionOutput,
} from "../base/scraper.types.js";
import { FACEBOOK_SELECTORS } from "./facebook.selectors.js";
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

type AccountSession = {
  id: string;
  sessionData: unknown;
};

type BrowserStorageState = {
  cookies: unknown[];
  origins: unknown[];
};

type ExtractedProfileCandidate = {
  name: string;
  profileUrl: string;
};

// FIX: Thêm dấu ? cho name và profileUrl vì hàm extractCommentCandidates không trả về chúng
type ExtractedCommentCandidate = {
  name?: string;
  profileUrl?: string;
  commentText: string;
  fbCommentId?: string;
};

// FIX: Thêm dấu ? cho name và profileUrl
type ExtractedReactionCandidate = {
  name?: string;
  profileUrl?: string;
  reactionType: string;
};

const FAST_LOCAL_MODE = process.env.CRAWLER_FAST_LOCAL_MODE === "true";

const FB_HANDLER_TIMEOUT_SECS = FAST_LOCAL_MODE ? 30 : 45;
const FB_NETWORKIDLE_TIMEOUT_MS = FAST_LOCAL_MODE ? 7_000 : 15_000;
const FB_DOMCONTENT_TIMEOUT_MS = FAST_LOCAL_MODE ? 5_000 : 10_000;

const FB_MAX_COMMENT_SCAN_NODES = FAST_LOCAL_MODE ? 120 : 320;
const FB_MAX_COMMENT_RESULTS = 15;
const FB_MAX_REACTION_SCAN_NODES = FAST_LOCAL_MODE ? 120 : 280;
const FB_MAX_REACTION_RESULTS = FAST_LOCAL_MODE ? 12 : 20;
const FB_MAX_SCROLL = 3;
const FB_SCROLL_WAIT_MS = FAST_LOCAL_MODE ? 700 : 2_000;
const MAX_POST_TIME_MS = 30_000;

async function detectBlockedReasonOnPage(
  page: Page,
): Promise<"LOGIN_WALL" | "CAPTCHA" | null> {
  const currentUrl = page.url().toLowerCase();
  if (
    currentUrl.includes("login") ||
    currentUrl.includes("checkpoint") ||
    currentUrl.includes("recover")
  ) {
    return "LOGIN_WALL";
  }

  const loginFormCount = await page
    .locator('form[action*="login"], input[name="email"], input[name="pass"]')
    .count();
  if (loginFormCount > 0) {
    return "LOGIN_WALL";
  }

  const captchaCount = await page
    .locator('iframe[src*="captcha"], div[id*="captcha"]')
    .count();
  return captchaCount > 0 ? "CAPTCHA" : null;
}

function toStableNumericHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return `${hash}`;
}

function parseFacebookPostId(targetUrl: string): string {
  const patterns = [
    /[?&]story_fbid=(\d+)/i,
    /\/posts\/(\d+)/i,
    /\/permalink\/(\d+)/i,
    /\/videos\/(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = targetUrl.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return `url-${toStableNumericHash(targetUrl)}`;
}

function parseFacebookProfileUid(profileUrl: string): string {
  const directId = profileUrl.match(/[?&]id=(\d+)/i)?.[1];
  if (directId) {
    return directId;
  }

  const username = profileUrl
    .replace(/^https?:\/\/[^/]+\//i, "")
    .split(/[/?#]/)[0]
    .replace(/^profile\.php$/i, "")
    .trim();

  if (username) {
    return `u-${username.toLowerCase()}`;
  }

  return `u-${toStableNumericHash(profileUrl)}`;
}

function normalizeReactionTypeFromLabel(
  label: string,
): "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD" | "ANGRY" | null {
  const normalized = label.toLowerCase();

  if (normalized.includes("love") || normalized.includes("thương")) {
    return "LOVE";
  }

  if (
    normalized.includes("haha") ||
    normalized.includes("cười") ||
    normalized.includes("laugh")
  ) {
    return "HAHA";
  }

  if (normalized.includes("wow") || normalized.includes("ngạc nhiên")) {
    return "WOW";
  }

  if (
    normalized.includes("sad") ||
    normalized.includes("buồn") ||
    normalized.includes("care")
  ) {
    return "SAD";
  }

  if (
    normalized.includes("angry") ||
    normalized.includes("phẫn nộ") ||
    normalized.includes("giận")
  ) {
    return "ANGRY";
  }

  if (
    normalized.includes("like") ||
    normalized.includes("thích") ||
    normalized.includes("reaction")
  ) {
    return "LIKE";
  }

  return null;
}

async function extractProfileCandidates(
  page: Page,
): Promise<ExtractedProfileCandidate[]> {
  return page.evaluate(() => {
    const anchors = Array.from(
      document.querySelectorAll('a[href*="facebook.com"]'),
    );

    const mapped = [];
    for (const anchor of anchors) {
      const htmlAnchor = anchor as HTMLAnchorElement;
      const name = (htmlAnchor.textContent ?? "").trim().replace(/\s+/g, " ");
      const href = htmlAnchor.href;

      if (!name || name.length < 2 || name.length > 80) {
        continue;
      }

      if (!href.includes("facebook.com") || href.includes("/plugins/")) {
        continue;
      }

      if (href.includes("/help") || href.includes("/privacy")) {
        continue;
      }

      mapped.push({
        name,
        profileUrl: href,
      });
    }

    const seen = new Set<string>();
    const unique: Array<{ name: string; profileUrl: string }> = [];

    for (const item of mapped) {
      if (seen.has(item.profileUrl)) {
        continue;
      }

      seen.add(item.profileUrl);
      unique.push(item);

      if (unique.length >= 20) {
        break;
      }
    }

    return unique;
  });
}

async function extractCommentCandidates(
  page: Page,
): Promise<ExtractedCommentCandidate[]> {
  return page.evaluate(
    (limits) => {
      const nodes = Array.from(
        document.querySelectorAll(
          'ul li div[dir="auto"], div[role="article"] div[dir="auto"], div[data-ad-preview="message"]',
        ),
      ).slice(0, limits.maxScanNodes);

      const values = [];
      let commentsCount = 0;
      for (const node of nodes) {
        const htmlNode = node as HTMLElement;
        const text = (htmlNode.innerText ?? "").trim().replace(/\s+/g, " ");
        if (text.length < 8 || text.length > 500) {
          continue;
        }

        if (/^https?:\/\//i.test(text)) {
          continue;
        }

        let fbCommentId;
        const attrCandidates = [
          htmlNode.getAttribute("data-commentid"),
          htmlNode.getAttribute("data-comment-id"),
          htmlNode.getAttribute("id"),
        ].filter(Boolean);

        for (const value of attrCandidates) {
          const direct = value && value.match(/(\d{8,})/)?.[1];
          if (direct) {
            fbCommentId = direct;
            break;
          }
        }

        if (!fbCommentId) {
          const anchor = htmlNode.querySelector(
            'a[href*="comment_id="], a[href*="/comment/"]',
          ) as HTMLAnchorElement | null;
          if (anchor?.href) {
            fbCommentId = anchor.href.match(/comment_id=(\d+)/i)?.[1];

            if (!fbCommentId) {
              fbCommentId = anchor.href.match(/\/comment\/(\d+)/i)?.[1];
            }
          }
        }

        // FIX: Đổi 'text' thành 'commentText' để khớp với interface
        values.push({
          fbCommentId,
          commentText: text,
        });
        commentsCount += 1;

        if (commentsCount >= limits.maxResults) {
          break;
        }
      }

      const seen = new Set<string>();
      const unique: ExtractedCommentCandidate[] = [];

      for (const value of values) {
        const dedupKey = `${value.fbCommentId ?? "none"}::${value.commentText}`;
        if (seen.has(dedupKey)) {
          continue;
        }

        seen.add(dedupKey);
        unique.push(value as ExtractedCommentCandidate);

        if (unique.length >= limits.maxResults) {
          break;
        }
      }

      return unique;
    },
    {
      maxScanNodes: FB_MAX_COMMENT_SCAN_NODES,
      maxResults: FB_MAX_COMMENT_RESULTS,
    },
  );
}

async function extractCommentsWithUsers(
  page: Page,
): Promise<ExtractedCommentCandidate[]> {
  return page.evaluate(() => {
    const commentNodes = Array.from(
      document.querySelectorAll(
        'div[role="article"], ul[role="list"] > li, div[data-ad-preview="message"]',
      ),
    );

    const comments: Array<{
      name: string;
      profileUrl: string;
      commentText: string;
      fbCommentId?: string;
    }> = [];

    for (const node of commentNodes) {
      const userLink = node.querySelector(
        'a[href*="facebook.com"]',
      ) as HTMLAnchorElement;
      if (!userLink) continue;

      const name = userLink.textContent?.trim() || "";
      const profileUrl = userLink.href;

      if (!name || name.length < 2 || !profileUrl.includes("facebook.com")) {
        continue;
      }

      const textNode = node.querySelector('div[dir="auto"]') as HTMLElement;
      if (!textNode) continue;

      const commentText = textNode.innerText?.trim() || "";
      if (commentText.length < 1 || commentText.length > 500) {
        continue;
      }

      let fbCommentId: string | undefined;
      const commentIdAttr = (node as HTMLElement).getAttribute(
        "data-commentid",
      );
      if (commentIdAttr) {
        fbCommentId = commentIdAttr;
      } else {
        const replyLink = node.querySelector(
          'a[href*="comment_id="]',
        ) as HTMLAnchorElement;
        if (replyLink) {
          const match = replyLink.href.match(/comment_id=(\d+)/);
          if (match) {
            fbCommentId = match[1];
          }
        }
      }

      comments.push({
        name,
        profileUrl,
        commentText,
        fbCommentId,
      });

      if (comments.length >= 50) break;
    }

    return comments;
  });
}

async function extractReactionsWithUsers(
  page: Page,
  postUrl: string,
): Promise<ExtractedReactionCandidate[]> {
  return page.evaluate(() => {
    const results: Array<{
      name: string;
      profileUrl: string;
      reactionType: string;
    }> = [];

    try {
      // FIX: Ép kiểu as HTMLElement để có thể gọi hàm click()
      const reactionsButton = document.querySelector(
        '[aria-label*="reaction"], [aria-label*="cảm xúc"], a[href*="/ufi/reaction"]',
      ) as HTMLElement | null;

      if (!reactionsButton) {
        console.log("No reactions button found");
        return [];
      }

      reactionsButton.click();

      new Promise((resolve) => setTimeout(resolve, 2000));

      const popup = document.querySelector(
        '[role="dialog"], [role="complementary"]',
      );
      if (popup) {
        for (let i = 0; i < 3; i++) {
          (popup as HTMLElement).scrollTop = (
            popup as HTMLElement
          ).scrollHeight;
          new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      const items = Array.from(
        document.querySelectorAll(
          '[role="dialog"] a[href*="facebook.com"], [role="complementary"] a[href*="facebook.com"]',
        ),
      );

      for (const item of items) {
        const anchor = item as HTMLAnchorElement;
        const name = anchor.textContent?.trim() || "";
        const profileUrl = anchor.href;

        if (!name || name.length < 2 || !profileUrl.includes("facebook.com")) {
          continue;
        }

        const parent = anchor.closest(
          '[role="listitem"], li, div[data-visualcompletion]',
        );
        if (!parent) continue;

        const ariaLabel = parent.getAttribute("aria-label") || "";
        let reactionType = "LIKE";

        if (ariaLabel.includes("love") || ariaLabel.includes("thương")) {
          reactionType = "LOVE";
        } else if (ariaLabel.includes("haha") || ariaLabel.includes("cười")) {
          reactionType = "HAHA";
        } else if (
          ariaLabel.includes("wow") ||
          ariaLabel.includes("ngạc nhiên")
        ) {
          reactionType = "WOW";
        } else if (ariaLabel.includes("sad") || ariaLabel.includes("buồn")) {
          reactionType = "SAD";
        } else if (
          ariaLabel.includes("angry") ||
          ariaLabel.includes("phẫn nộ")
        ) {
          reactionType = "ANGRY";
        }

        results.push({ name, profileUrl, reactionType });

        if (results.length >= 50) break;
      }

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Failed to extract reactions with users:", error);
    }

    return results;
  });
}

async function extractReactionCandidates(
  page: Page,
): Promise<ExtractedReactionCandidate[]> {
  return page.evaluate(
    (limits) => {
      const iconToType = new Map<string, string>([
        ["like", "LIKE"],
        ["thumb", "LIKE"],
        ["love", "LOVE"],
        ["heart", "LOVE"],
        ["haha", "HAHA"],
        ["laugh", "HAHA"],
        ["wow", "WOW"],
        ["care", "SAD"],
        ["sad", "SAD"],
        ["angry", "ANGRY"],
      ]);

      const nodes = Array.from(
        document.querySelectorAll(
          '[aria-label*="Like"], [aria-label*="love"], [aria-label*="haha"], [aria-label*="wow"], [aria-label*="sad"], [aria-label*="angry"], [aria-label*="Thích"], [aria-label*="thương"], [aria-label*="phẫn nộ"], [aria-label*="buồn"], [data-visualcompletion="ignore-dynamic"]',
        ),
      ).slice(0, limits.maxScanNodes);

      const reactions: ExtractedReactionCandidate[] = [];

      for (const node of nodes) {
        const htmlNode = node as HTMLElement;
        const ariaLabel =
          htmlNode.getAttribute("aria-label") ||
          htmlNode.getAttribute("alt") ||
          htmlNode.textContent ||
          "";

        const normalized = ariaLabel.toLowerCase();
        let reactionType = null;
        if (normalized.includes("love") || normalized.includes("thương")) {
          reactionType = "LOVE";
        } else if (
          normalized.includes("haha") ||
          normalized.includes("cười") ||
          normalized.includes("laugh")
        ) {
          reactionType = "HAHA";
        } else if (
          normalized.includes("wow") ||
          normalized.includes("ngạc nhiên")
        ) {
          reactionType = "WOW";
        } else if (
          normalized.includes("sad") ||
          normalized.includes("buồn") ||
          normalized.includes("care")
        ) {
          reactionType = "SAD";
        } else if (
          normalized.includes("angry") ||
          normalized.includes("phẫn nộ") ||
          normalized.includes("giận")
        ) {
          reactionType = "ANGRY";
        } else if (
          normalized.includes("like") ||
          normalized.includes("thích") ||
          normalized.includes("reaction")
        ) {
          reactionType = "LIKE";
        }

        if (!reactionType) {
          const iconText = [
            htmlNode.getAttribute("data-icon"),
            htmlNode.getAttribute("xlink:href"),
            htmlNode.className,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          for (const [iconKey, mapped] of iconToType.entries()) {
            if (iconText.includes(iconKey)) {
              reactionType = mapped;
              break;
            }
          }
        }

        if (!reactionType) {
          continue;
        }

        // Đã được match với interface có chứa name?, profileUrl?
        reactions.push({
          reactionType:
            reactionType as ExtractedReactionCandidate["reactionType"],
        });

        if (reactions.length >= limits.maxResults) {
          break;
        }
      }

      return reactions;
    },
    {
      maxScanNodes: FB_MAX_REACTION_SCAN_NODES,
      maxResults: FB_MAX_REACTION_RESULTS,
    },
  );
}

function buildEntities(params: {
  url: string;
  title: string;
  rawText: string;
  profileCandidates: ExtractedProfileCandidate[];
  commentCandidates: ExtractedCommentCandidate[];
  reactionCandidates: ExtractedReactionCandidate[];
}): ScrapedEntities {
  const profileMap = new Map<string, ScrapedProfileEntity>();

  for (const item of params.profileCandidates) {
    const fbUid = parseFacebookProfileUid(item.profileUrl);
    profileMap.set(fbUid, {
      fbUid,
      name: item.name,
      profileUrl: item.profileUrl,
    });
  }

  // FIX: Chỉ extract profile map nếu có profileUrl
  for (const comment of params.commentCandidates) {
    if (comment.profileUrl && comment.name) {
      const fbUid = parseFacebookProfileUid(comment.profileUrl);
      if (!profileMap.has(fbUid)) {
        profileMap.set(fbUid, {
          fbUid,
          name: comment.name,
          profileUrl: comment.profileUrl,
        });
      }
    }
  }

  for (const reaction of params.reactionCandidates) {
    if (reaction.profileUrl && reaction.name) {
      const fbUid = parseFacebookProfileUid(reaction.profileUrl);
      if (!profileMap.has(fbUid)) {
        profileMap.set(fbUid, {
          fbUid,
          name: reaction.name,
          profileUrl: reaction.profileUrl,
        });
      }
    }
  }

  const profiles = Array.from(profileMap.values());

  const fallbackAuthor = profiles[0]?.name || params.title || "Facebook User";
  const post: ScrapedPostEntity = {
    fbPostId: parseFacebookPostId(params.url),
    postUrl: params.url,
    authorName: fallbackAuthor,
    content: params.rawText.slice(0, 2000),
  };

  const commentInteractions: ScrapedInteractionEntity[] =
    params.commentCandidates.map((comment) => {
      // Dùng fallback ID nếu profileUrl null
      const profileFbUid = comment.profileUrl
        ? parseFacebookProfileUid(comment.profileUrl)
        : "u-unknown-commenter";

      return {
        type: "COMMENT",
        fbCommentId:
          comment.fbCommentId ??
          `c-${post.fbPostId}-${toStableNumericHash(comment.commentText)}`,
        fbPostId: post.fbPostId,
        commentText: comment.commentText,
        profileFbUid,
      };
    });

  const reactionInteractions: ScrapedInteractionEntity[] =
    params.reactionCandidates.map((reaction) => {
      // Dùng fallback ID nếu profileUrl null
      const profileFbUid = reaction.profileUrl
        ? parseFacebookProfileUid(reaction.profileUrl)
        : "u-unknown-reactor";

      return {
        type: "REACTION",
        reactionType:
          normalizeReactionTypeFromLabel(reaction.reactionType) ?? "LIKE",
        fbPostId: post.fbPostId,
        profileFbUid,
      };
    });

  return {
    posts: [post],
    profiles,
    interactions: [...commentInteractions, ...reactionInteractions],
  };
}

async function applyStorageState(
  page: Page,
  storageState: BrowserStorageState,
  targetUrl: string,
): Promise<void> {
  if (storageState.cookies.length > 0) {
    await page.context().addCookies(storageState.cookies as any[]);
  }

  const targetOrigin = new URL(targetUrl).origin;
  const matchedOrigin = (
    storageState.origins as Array<{
      origin?: string;
      localStorage?: Array<{ name?: string; value?: string }>;
    }>
  ).find((item) => item.origin === targetOrigin);

  if (!matchedOrigin?.localStorage || matchedOrigin.localStorage.length === 0) {
    return;
  }

  const entries = matchedOrigin.localStorage
    .filter((entry) => typeof entry.name === "string")
    .map((entry) => [entry.name as string, entry.value ?? ""]);

  if (entries.length > 0) {
    await page.addInitScript((pairs) => {
      for (const [key, value] of pairs) {
        window.localStorage.setItem(key, value);
      }
    }, entries);
  }
}

function isBrowserStorageState(value: unknown): value is BrowserStorageState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const maybeState = value as {
    cookies?: unknown;
    origins?: unknown;
  };

  return Array.isArray(maybeState.cookies) && Array.isArray(maybeState.origins);
}

export class FacebookScraper extends BaseScraper {
  readonly platform = "facebook";

  async execute(
    input: ScrapeExecutionInput,
    _options?: ScrapeOptions,
  ): Promise<ScrapeExecutionOutput> {
    enforceProxyRequired(input.proxy);
    const assignedProxy = input.proxy!;

    const targetUrl = input.url?.trim();
    if (!targetUrl) {
      throw new ScraperError("UNKNOWN", "DIRECT_URL requires url");
    }

    const scraper = this;
    const proxyConfiguration = input.proxy
      ? new ProxyConfiguration({ proxyUrls: [input.proxy.url] })
      : undefined;
    let prisma: ReturnType<typeof getPrisma> | null = null;
    let account: AccountSession | null = null;
    let storageState: BrowserStorageState | undefined;

    try {
      prisma = getPrisma();
      account = await prisma.account.findFirst({
        where: {
          platform: "facebook",
          status: "ACTIVE",
        },
        orderBy: [{ lastUsedAt: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          sessionData: true,
        },
      });
    } catch (error) {
      logJobEvent("warn", {
        jobId: input.jobId,
        platform: "facebook",
        phase: "auth",
        step: "account-query",
        message: "Unable to load account session, fallback to anonymous crawl",
        meta: {
          error: error instanceof Error ? error.message : "unknown",
        },
      });
    }

    if (account) {
      if (isBrowserStorageState(account.sessionData)) {
        storageState = account.sessionData;
      } else {
        logJobEvent("warn", {
          jobId: input.jobId,
          platform: "facebook",
          phase: "auth",
          step: "storage-state-validate",
          message:
            "Account sessionData is invalid, fallback to anonymous crawl",
          meta: { accountId: account.id },
        });
      }
    } else {
      logJobEvent("warn", {
        jobId: input.jobId,
        platform: "facebook",
        phase: "auth",
        step: "account-select",
        message: "No ACTIVE facebook account found, running anonymous",
      });
    }

    return new Promise<ScrapeExecutionOutput>((resolve, reject) => {
      const crawler = new PlaywrightCrawler({
        browserPoolOptions: {
          retireBrowserAfterPageCount: 10,
        },
        maxRequestsPerCrawl: 1,
        requestHandlerTimeoutSecs: FB_HANDLER_TIMEOUT_SECS,
        headless: true,
        proxyConfiguration,
        preNavigationHooks: storageState
          ? [
              async ({ page, request }) => {
                await applyStorageState(
                  page,
                  storageState,
                  request.loadedUrl ?? targetUrl,
                );
              },
            ]
          : undefined,
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
              platform: "facebook",
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
              platform: "facebook",
              proxy: input.proxy,
            });

            const reportProgress = async (progress: number, step: string) => {
              if (input.onProgress) {
                await input.onProgress(progress, step);
              }
            };

            const profileMap = new Map<string, ExtractedProfileCandidate>();
            const commentMap = new Map<string, ExtractedCommentCandidate>();
            const reactionList: ExtractedReactionCandidate[] = [];
            let rawText = "";
            let title = "Facebook";
            let feedExists = false;
            let hitTimeLimit = false;
            let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

            const scrapePostTask = (async (): Promise<void> => {
              log.info(`STEP 1: Open URL ${request.loadedUrl ?? targetUrl}`);
              logJobEvent("info", {
                jobId: input.jobId,
                platform: "facebook",
                phase: "navigate",
                step: "open-url",
                message: "Opening target URL",
                meta: {
                  url: request.loadedUrl ?? targetUrl,
                  proxy: input.proxy
                    ? {
                        address: input.proxy.address,
                        port: input.proxy.port,
                        region: input.proxy.region,
                      }
                    : undefined,
                },
              });

              await page.goto(request.loadedUrl ?? targetUrl, {
                waitUntil: "domcontentloaded",
              });
              await reportProgress(50, "step-open-url");

              log.info("STEP 2: Wait page stable");
              try {
                await page.waitForLoadState("networkidle", {
                  timeout: FB_NETWORKIDLE_TIMEOUT_MS,
                });
              } catch {
                try {
                  await page.waitForLoadState("domcontentloaded", {
                    timeout: FB_DOMCONTENT_TIMEOUT_MS,
                  });
                } catch {
                  throw new ScraperError(
                    "TIMEOUT",
                    "Facebook page did not become stable in time",
                  );
                }
              }

              const blockedReason = await detectBlockedReasonOnPage(page);
              if (blockedReason) {
                throw new ScraperError(
                  blockedReason,
                  `Facebook blocked access: ${blockedReason}`,
                );
              }

              const currentUrl = page.url();
              if (
                account &&
                prisma &&
                currentUrl.toLowerCase().includes("login")
              ) {
                await prisma.account.update({
                  where: { id: account.id },
                  data: { status: "EXPIRED" },
                });

                logJobEvent("warn", {
                  jobId: input.jobId,
                  platform: "facebook",
                  phase: "auth",
                  step: "login-wall-detected",
                  message: "Detected login wall, account marked as EXPIRED",
                  meta: {
                    accountId: account.id,
                    url: currentUrl,
                  },
                });
              }

              await reportProgress(55, "step-page-stable");

              if (input.debugMode) {
                log.info("STEP 2.5: Capture debug screenshot");
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

              log.info("STEP 3: Scroll + extract with limits");
              for (
                let scrollCount = 0;
                scrollCount < FB_MAX_SCROLL;
                scrollCount += 1
              ) {
                if (scrollCount > 0) {
                  await page.mouse.wheel(0, 2_000);
                  await page.waitForTimeout(FB_SCROLL_WAIT_MS);
                }

                const scrollBlockedReason =
                  await detectBlockedReasonOnPage(page);
                if (scrollBlockedReason) {
                  throw new ScraperError(
                    scrollBlockedReason,
                    `Facebook blocked during scroll: ${scrollBlockedReason}`,
                  );
                }

                const loopRawText = await page
                  .locator(FACEBOOK_SELECTORS.fallbackBody)
                  .innerText();
                if (loopRawText.length > rawText.length) {
                  rawText = loopRawText;
                }

                const profiles = await extractProfileCandidates(page);
                const comments = await extractCommentCandidates(page);
                const reactions = await extractReactionCandidates(page);

                for (const profile of profiles) {
                  profileMap.set(profile.profileUrl, profile);
                }

                for (const comment of comments) {
                  const key = `${comment.fbCommentId ?? "none"}::${comment.commentText}`;
                  commentMap.set(key, comment);

                  if (commentMap.size >= FB_MAX_COMMENT_RESULTS) {
                    break;
                  }
                }

                reactionList.splice(
                  0,
                  reactionList.length,
                  ...[...reactionList, ...reactions].slice(
                    0,
                    FB_MAX_REACTION_RESULTS,
                  ),
                );

                const loopProgress = Math.min(
                  68,
                  55 + Math.round(((scrollCount + 1) / FB_MAX_SCROLL) * 13),
                );
                await reportProgress(loopProgress, `scroll-${scrollCount + 1}`);
                log.info(
                  `STEP 3: Scrolling (${scrollCount + 1}/${FB_MAX_SCROLL})`,
                );

                if (commentMap.size >= FB_MAX_COMMENT_RESULTS) {
                  log.info(
                    "STEP 3: Hit max comments limit, stop scrolling early",
                  );
                  break;
                }
              }

              title = await page.title();
              feedExists =
                (await page.locator(FACEBOOK_SELECTORS.feedRoot).count()) > 0;
            })();

            try {
              await Promise.race([
                scrapePostTask,
                new Promise<never>((_, rejectRace) => {
                  timeoutTimer = setTimeout(() => {
                    rejectRace(
                      new ScraperError(
                        "TIMEOUT",
                        `Deep scrape exceeded ${MAX_POST_TIME_MS}ms for a single post`,
                      ),
                    );
                  }, MAX_POST_TIME_MS);
                }),
              ]);
            } catch (error) {
              const isTimeout =
                error instanceof ScraperError && error.reason === "TIMEOUT";

              if (!isTimeout) {
                throw error;
              }

              hitTimeLimit = true;
              logJobEvent("warn", {
                jobId: input.jobId,
                platform: "facebook",
                phase: "extract",
                step: "deep-scrape-time-limit",
                message: "Reached time limit per post, return partial data",
                meta: {
                  url: request.loadedUrl ?? targetUrl,
                  maxPostTimeMs: MAX_POST_TIME_MS,
                  commentsCollected: commentMap.size,
                  profilesCollected: profileMap.size,
                  reactionsCollected: reactionList.length,
                },
              });
            } finally {
              if (timeoutTimer) {
                clearTimeout(timeoutTimer);
              }
            }

            if (title === "Facebook") {
              title = await page.title().catch(() => "Facebook");
            }

            if (!feedExists) {
              const feedCount = await page
                .locator(FACEBOOK_SELECTORS.feedRoot)
                .count()
                .catch(() => 0);
              feedExists = feedCount > 0;
            }

            if (!rawText) {
              rawText = await page
                .locator(FACEBOOK_SELECTORS.fallbackBody)
                .innerText()
                .catch(() => "");
            }

            const entities = buildEntities({
              url: request.loadedUrl ?? targetUrl,
              title,
              rawText,
              profileCandidates: [...profileMap.values()],
              commentCandidates: [...commentMap.values()].slice(
                0,
                FB_MAX_COMMENT_RESULTS,
              ),
              reactionCandidates: reactionList,
            });

            if (input.debugMode) {
              log.info("STEP 5: Save raw extract");
              const rawExtractPath = await saveRawExtract({
                jobId: input.jobId,
                label: "facebook-body",
                payload: {
                  url: request.loadedUrl ?? targetUrl,
                  title,
                  feedExists,
                  rawText,
                  scrollLoops: FB_MAX_SCROLL,
                  maxComments: FB_MAX_COMMENT_RESULTS,
                  maxPostTimeMs: MAX_POST_TIME_MS,
                  timedOut: hitTimeLimit,
                  fastLocalMode: FAST_LOCAL_MODE,
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

            if (prisma && account) {
              await prisma.account.update({
                where: { id: account.id },
                data: { lastUsedAt: new Date() },
              });
            }

            await reportProgress(
              69,
              hitTimeLimit
                ? "step-ready-to-persist-partial"
                : "step-ready-to-persist",
            );

            resolve({
              url: request.loadedUrl ?? targetUrl,
              title: feedExists ? `[Feed] ${title}` : title,
              previewSnippet: scraper.createPreview(rawText),
              crawledAt: new Date().toISOString(),
              entities,
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
