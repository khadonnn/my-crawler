import { PlaywrightCrawler } from "crawlee";
import { getPrisma } from "@scraping-platform/db";
import type { Page } from "playwright";
import { BaseScraper } from "../base/base.scraper.js";
import type {
  ScrapedEntities,
  ScrapedInteractionEntity,
  ScrapedPostEntity,
  ScrapedProfileEntity,
  ScrapeExecutionInput,
  ScrapeExecutionOutput,
} from "../base/scraper.types.js";
import { FACEBOOK_SELECTORS } from "./facebook.selectors.js";
import {
  captureJobScreenshot,
  logJobEvent,
  saveRawExtract,
} from "../../observability/index.js";

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

type ExtractedCommentCandidate = {
  fbCommentId?: string;
  text: string;
};

type ExtractedReactionCandidate = {
  reactionType: "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD" | "ANGRY";
  profileNameHint?: string;
};

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
      document.querySelectorAll<HTMLAnchorElement>('a[href*="facebook.com"]'),
    );

    const mapped = anchors
      .map((anchor) => {
        const name = (anchor.textContent ?? "").trim().replace(/\s+/g, " ");
        const href = anchor.href;

        if (!name || name.length < 2 || name.length > 80) {
          return null;
        }

        if (!href.includes("facebook.com") || href.includes("/plugins/")) {
          return null;
        }

        if (href.includes("/help") || href.includes("/privacy")) {
          return null;
        }

        return {
          name,
          profileUrl: href,
        };
      })
      .filter(
        (item): item is { name: string; profileUrl: string } => item !== null,
      );

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
  return page.evaluate(() => {
    const toCommentId = (element: HTMLElement): string | undefined => {
      const attrCandidates = [
        element.getAttribute("data-commentid"),
        element.getAttribute("data-comment-id"),
        element.getAttribute("id"),
      ].filter((value): value is string => Boolean(value));

      for (const value of attrCandidates) {
        const direct = value.match(/(\d{8,})/)?.[1];
        if (direct) {
          return direct;
        }
      }

      const anchor = element.querySelector<HTMLAnchorElement>(
        'a[href*="comment_id="], a[href*="/comment/"]',
      );
      if (anchor?.href) {
        const commentId = anchor.href.match(/comment_id=(\d+)/i)?.[1];
        if (commentId) {
          return commentId;
        }

        const routeId = anchor.href.match(/\/comment\/(\d+)/i)?.[1];
        if (routeId) {
          return routeId;
        }
      }

      return undefined;
    };

    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        'ul li div[dir="auto"], div[role="article"] div[dir="auto"], div[data-ad-preview="message"]',
      ),
    );

    const values = nodes
      .map((node): ExtractedCommentCandidate | null => {
        const text = (node.innerText ?? "").trim().replace(/\s+/g, " ");
        if (text.length < 8 || text.length > 500) {
          return null;
        }

        if (/^https?:\/\//i.test(text)) {
          return null;
        }

        return {
          fbCommentId: toCommentId(node),
          text,
        };
      })
      .filter((item): item is ExtractedCommentCandidate => item !== null);

    const seen = new Set<string>();
    const unique: ExtractedCommentCandidate[] = [];

    for (const value of values) {
      const dedupKey = `${value.fbCommentId ?? "none"}::${value.text}`;
      if (seen.has(dedupKey)) {
        continue;
      }

      seen.add(dedupKey);
      unique.push(value);

      if (unique.length >= 30) {
        break;
      }
    }

    return unique;
  });
}

async function extractReactionCandidates(
  page: Page,
): Promise<ExtractedReactionCandidate[]> {
  return page.evaluate(() => {
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

    const fromLabel = (label: string): string | null => {
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
    };

    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[aria-label*="Like"], [aria-label*="love"], [aria-label*="haha"], [aria-label*="wow"], [aria-label*="sad"], [aria-label*="angry"], [aria-label*="Thích"], [aria-label*="thương"], [aria-label*="phẫn nộ"], [aria-label*="buồn"], [data-visualcompletion="ignore-dynamic"]',
      ),
    );

    const reactions: ExtractedReactionCandidate[] = [];

    for (const node of nodes) {
      const ariaLabel =
        node.getAttribute("aria-label") ||
        node.getAttribute("alt") ||
        node.textContent ||
        "";

      let reactionType = fromLabel(ariaLabel);
      if (!reactionType) {
        const iconText = [
          node.getAttribute("data-icon"),
          node.getAttribute("xlink:href"),
          node.className,
        ]
          .filter((value): value is string => Boolean(value))
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

      reactions.push({
        reactionType:
          reactionType as ExtractedReactionCandidate["reactionType"],
      });

      if (reactions.length >= 20) {
        break;
      }
    }

    return reactions;
  });
}

function buildEntities(params: {
  url: string;
  title: string;
  rawText: string;
  profileCandidates: ExtractedProfileCandidate[];
  commentCandidates: ExtractedCommentCandidate[];
  reactionCandidates: ExtractedReactionCandidate[];
}): ScrapedEntities {
  const profiles: ScrapedProfileEntity[] = params.profileCandidates
    .map((item) => ({
      fbUid: parseFacebookProfileUid(item.profileUrl),
      name: item.name,
      profileUrl: item.profileUrl,
    }))
    .filter((item) => Boolean(item.fbUid && item.name && item.profileUrl));

  const fallbackAuthor =
    profiles[0]?.name ||
    params.title.replace(/^\[Feed\]\s*/i, "").trim() ||
    "Facebook User";
  const post: ScrapedPostEntity = {
    fbPostId: parseFacebookPostId(params.url),
    postUrl: params.url,
    authorName: fallbackAuthor,
    content: params.rawText.slice(0, 2000),
  };

  const availableProfiles =
    profiles.length > 0
      ? profiles
      : [
          {
            fbUid: `u-${toStableNumericHash(params.url)}`,
            name: fallbackAuthor,
            profileUrl: params.url,
          },
        ];

  const comments = params.commentCandidates.slice(0, 20);
  const commentInteractions: ScrapedInteractionEntity[] = comments.map(
    (comment, index) => ({
      type: "COMMENT",
      fbCommentId:
        comment.fbCommentId ??
        `c-${post.fbPostId}-${toStableNumericHash(`${comment.text}-${index}`)}`,
      commentText: comment.text,
      profileFbUid: availableProfiles[index % availableProfiles.length].fbUid,
    }),
  );

  const reactionInteractions: ScrapedInteractionEntity[] =
    params.reactionCandidates.slice(0, 10).map((reaction, index) => {
      const normalizedReactionType = normalizeReactionTypeFromLabel(
        reaction.reactionType,
      );

      return {
        type: "REACTION",
        reactionType: normalizedReactionType ?? "LIKE",
        profileFbUid: availableProfiles[index % availableProfiles.length].fbUid,
      };
    });

  return {
    posts: [post],
    profiles: availableProfiles,
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

  async execute(input: ScrapeExecutionInput): Promise<ScrapeExecutionOutput> {
    const scraper = this;
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
        requestHandlerTimeoutSecs: 45,
        headless: true,
        preNavigationHooks: storageState
          ? [
              async ({ page, request }) => {
                await applyStorageState(
                  page,
                  storageState,
                  request.loadedUrl ?? input.url,
                );
              },
            ]
          : undefined,
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

          const currentUrl = page.url();
          if (account && prisma && currentUrl.toLowerCase().includes("login")) {
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
          const profileCandidates = await extractProfileCandidates(page);
          const commentCandidates = await extractCommentCandidates(page);
          const reactionCandidates = await extractReactionCandidates(page);
          const entities = buildEntities({
            url: request.loadedUrl ?? input.url,
            title,
            rawText,
            profileCandidates,
            commentCandidates,
            reactionCandidates,
          });

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

          if (prisma && account) {
            await prisma.account.update({
              where: { id: account.id },
              data: { lastUsedAt: new Date() },
            });
          }

          resolve({
            url: request.loadedUrl ?? input.url,
            title: feedExists ? `[Feed] ${title}` : title,
            previewSnippet: scraper.createPreview(rawText),
            crawledAt: new Date().toISOString(),
            entities,
          });
        },
      });

      crawler.run([input.url]).catch(reject);
    });
  }
}
