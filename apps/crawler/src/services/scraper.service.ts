import fs from "node:fs/promises";
import path from "node:path";

import { getPrisma } from "@scraping-platform/db";
import { Dataset } from "crawlee";
import type {
  CrawlMode,
  Platform,
  ProxyRegion,
  ScrapedEntities,
  SelectedProxyConfig,
} from "../scrapers/base/scraper.types.js";
import {
  ScraperError,
  isBlockedReason,
  type BlockedReason,
} from "../errors/scraper.error.js";
import { createScraperStrategy } from "../scrapers/factory/scraper.factory.js";
import { cleanupOldArtifacts, logJobEvent } from "../observability/index.js";

export interface ScrapeJob {
  url: string;
  status: "pending" | "running" | "done" | "error";
  result?: any;
  error?: string;
  timestamp: number;
}

type AddScrapeJobOptions = {
  debugMode?: boolean;
  clientJobId?: string;
  proxyRegion?: ProxyRegion;
  platform?: Platform;
  mode?: CrawlMode;
  keyword?: string;
  preLocked?: boolean;
};

function normalizePlatform(value: unknown): Platform {
  if (
    value === "FACEBOOK" ||
    value === "GOOGLE" ||
    value === "YOUTUBE" ||
    value === "TIKTOK"
  ) {
    return value;
  }

  return "FACEBOOK";
}

function normalizeCrawlMode(value: unknown): CrawlMode {
  if (value === "DIRECT_URL" || value === "SEARCH_KEYWORD") {
    return value;
  }

  return "DIRECT_URL";
}

type ProxyRow = {
  id: string;
  address: string;
  port: number;
  username: string | null;
  password: string | null;
  protocol: string;
  region: ProxyRegion;
  status: string;
  latency: number;
};

function normalizeProxyRegion(value: unknown): ProxyRegion {
  if (value === "VN" || value === "US" || value === "ANY") {
    return value;
  }

  return "ANY";
}

function buildProxyUrl(proxy: ProxyRow): string {
  const protocol = proxy.protocol || "http";
  const auth =
    proxy.username && proxy.password
      ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
      : "";
  return `${protocol}://${auth}${proxy.address}:${proxy.port}`;
}

async function selectProxyForRegion(params: {
  prisma: ReturnType<typeof getPrisma>;
  proxyRegion: ProxyRegion;
}): Promise<SelectedProxyConfig | null> {
  const { prisma, proxyRegion } = params;
  const allowedStatuses = ["WORKING", "UNKNOWN"];

  const whereClause =
    proxyRegion === "ANY"
      ? { status: { in: allowedStatuses } }
      : {
          status: { in: allowedStatuses },
          region: proxyRegion,
        };

  const primaryCandidates = await prisma.proxy.findMany({
    where: whereClause,
    orderBy: { latency: "asc" },
    take: 30,
    select: {
      id: true,
      address: true,
      port: true,
      username: true,
      password: true,
      protocol: true,
      region: true,
      status: true,
      latency: true,
    },
  });

  const selectedPrimary =
    primaryCandidates.length > 0
      ? (primaryCandidates.find((proxy) => proxy.status === "WORKING") ??
        primaryCandidates[0])
      : null;

  let selected = selectedPrimary;
  if (!selected && proxyRegion !== "ANY") {
    const fallbackCandidates = await prisma.proxy.findMany({
      where: {
        status: { in: allowedStatuses },
      },
      orderBy: { latency: "asc" },
      take: 30,
      select: {
        id: true,
        address: true,
        port: true,
        username: true,
        password: true,
        protocol: true,
        region: true,
        status: true,
        latency: true,
      },
    });

    selected =
      fallbackCandidates.find((proxy) => proxy.status === "WORKING") ??
      fallbackCandidates[0] ??
      null;
  }

  if (!selected) {
    return null;
  }

  return {
    id: selected.id,
    address: selected.address,
    port: selected.port,
    region: normalizeProxyRegion(selected.region),
    protocol: selected.protocol,
    url: buildProxyUrl(selected),
  };
}

function detectBlockedReason(errorMessage: string): BlockedReason {
  const normalized = errorMessage.toLowerCase();

  if (
    normalized.includes("network") ||
    normalized.includes("enotfound") ||
    normalized.includes("econnreset") ||
    normalized.includes("etimedout")
  ) {
    return "NETWORK_ERROR";
  }

  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return "TIMEOUT";
  }

  if (normalized.includes("captcha")) {
    return "CAPTCHA";
  }

  if (normalized.includes("login") || normalized.includes("sign in")) {
    return "LOGIN_WALL";
  }

  return "UNKNOWN";
}

function resolveBlockedReason(error: unknown): BlockedReason {
  if (error instanceof ScraperError) {
    return error.reason;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "reason" in error &&
    isBlockedReason((error as { reason: unknown }).reason)
  ) {
    return (error as { reason: BlockedReason }).reason;
  }

  if (error instanceof Error) {
    return detectBlockedReason(error.message);
  }

  return "UNKNOWN";
}

function isAutoRetryableReason(reason: BlockedReason): boolean {
  return reason === "TIMEOUT" || reason === "NETWORK_ERROR";
}

function computeRetryDelayMs(retryCount: number): number {
  return 2 ** retryCount * 5_000;
}

async function collectArtifactPaths(workerJobId: string): Promise<{
  screenshots: string[];
  rawExtracts: string[];
}> {
  const baseDirectory = path.resolve(process.cwd(), "storage", workerJobId);
  const screenshotDirectory = path.join(baseDirectory, "screenshots");
  const rawExtractDirectory = path.join(baseDirectory, "raw-extracts");

  const [screenshots, rawExtracts] = await Promise.all([
    fs.readdir(screenshotDirectory).catch(() => [] as string[]),
    fs.readdir(rawExtractDirectory).catch(() => [] as string[]),
  ]);

  return {
    screenshots: screenshots.map((fileName) =>
      path.join("storage", workerJobId, "screenshots", fileName),
    ),
    rawExtracts: rawExtracts.map((fileName) =>
      path.join("storage", workerJobId, "raw-extracts", fileName),
    ),
  };
}

async function persistScrapedEntities(params: {
  prisma: ReturnType<typeof getPrisma>;
  clientJobId: string;
  entities?: ScrapedEntities;
}): Promise<void> {
  const { prisma, clientJobId, entities } = params;
  if (!entities) {
    return;
  }

  const posts = entities.posts ?? [];
  const profiles = entities.profiles ?? [];
  const interactions = entities.interactions ?? [];

  if (posts.length === 0) {
    return;
  }

  for (const post of posts) {
    await prisma.post.upsert({
      where: { fbPostId: post.fbPostId },
      update: {
        postUrl: post.postUrl,
        authorName: post.authorName,
        content: post.content ?? null,
        keywordMatched: post.keywordMatched ?? null,
        scrapedAt: new Date(),
        jobId: clientJobId,
      },
      create: {
        jobId: clientJobId,
        fbPostId: post.fbPostId,
        postUrl: post.postUrl,
        authorName: post.authorName,
        content: post.content ?? null,
        keywordMatched: post.keywordMatched ?? null,
      },
    });
  }

  for (const profile of profiles) {
    await prisma.profile.upsert({
      where: { fbUid: profile.fbUid },
      update: {
        jobId: clientJobId,
        name: profile.name,
        profileUrl: profile.profileUrl,
      },
      create: {
        jobId: clientJobId,
        fbUid: profile.fbUid,
        name: profile.name,
        profileUrl: profile.profileUrl,
      },
    });
  }

  const firstPost = posts[0];
  const dbPost = await prisma.post.findUnique({
    where: { fbPostId: firstPost.fbPostId },
    select: { id: true },
  });

  if (!dbPost) {
    return;
  }

  for (const interaction of interactions) {
    const dbProfile = await prisma.profile.findUnique({
      where: { fbUid: interaction.profileFbUid },
      select: { id: true },
    });

    if (!dbProfile) {
      continue;
    }

    if (interaction.type === "COMMENT") {
      if (!interaction.fbCommentId) {
        continue;
      }

      await prisma.interaction.upsert({
        where: { fbCommentId: interaction.fbCommentId },
        update: {
          jobId: clientJobId,
          postId: dbPost.id,
          profileId: dbProfile.id,
          type: "COMMENT",
          commentText: interaction.commentText ?? null,
          reactionType: null,
          interactedAt: interaction.interactedAt
            ? new Date(interaction.interactedAt)
            : null,
        },
        create: {
          jobId: clientJobId,
          postId: dbPost.id,
          profileId: dbProfile.id,
          type: "COMMENT",
          fbCommentId: interaction.fbCommentId,
          commentText: interaction.commentText ?? null,
          reactionType: null,
          interactedAt: interaction.interactedAt
            ? new Date(interaction.interactedAt)
            : null,
        },
      });

      continue;
    }

    await prisma.interaction.upsert({
      where: {
        unique_reaction: {
          profileId: dbProfile.id,
          postId: dbPost.id,
          type: "REACTION",
        },
      },
      update: {
        jobId: clientJobId,
        reactionType: interaction.reactionType ?? null,
        interactedAt: interaction.interactedAt
          ? new Date(interaction.interactedAt)
          : null,
      },
      create: {
        jobId: clientJobId,
        postId: dbPost.id,
        profileId: dbProfile.id,
        type: "REACTION",
        reactionType: interaction.reactionType ?? null,
        interactedAt: interaction.interactedAt
          ? new Date(interaction.interactedAt)
          : null,
      },
    });
  }
}

function createJobProgressUpdater(params: {
  prisma: ReturnType<typeof getPrisma> | null;
  clientJobId?: string;
}) {
  const { prisma, clientJobId } = params;

  async function updateProgress(progress: number) {
    if (!prisma || !clientJobId) {
      return;
    }

    try {
      await prisma.job.update({
        where: { id: clientJobId },
        data: {
          progress: Math.max(0, Math.min(100, Math.round(progress))),
          lastHeartbeatAt: new Date(),
        },
      });
    } catch {
      // Ignore progress update failures to keep crawl execution resilient.
    }
  }

  return { updateProgress };
}

class ScraperService {
  private crawlQueue: Map<string, ScrapeJob> = new Map();
  private readonly workerLoopIntervalMs = 10_000;
  private readonly hardTimeoutMs = 15 * 60 * 1000;
  private readonly workerId = `pid-${process.pid}-${Math.random().toString(36).slice(2, 6)}`;

  constructor() {
    // Memory cleanup: Remove jobs older than 1 hour
    this.startMemoryCleanup();
    this.startWorkerLoop();
    console.log(`\x1b[36m[WORKER ${this.workerId}] started\x1b[0m`);
  }

  /**
   * Start the memory cleanup interval
   * Runs every hour to remove old jobs
   */
  private startMemoryCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.crawlQueue.entries()) {
        if (now - value.timestamp > 3600000) {
          this.crawlQueue.delete(key);
        }
      }
    }, 3600000);
  }

  private startWorkerLoop(): void {
    setInterval(() => {
      void this.processRetryQueue();
      void this.processHardTimeouts();
    }, this.workerLoopIntervalMs);
  }

  private async processRetryQueue(): Promise<void> {
    const prisma = getPrisma();
    const now = new Date();

    const scheduledJobs = await prisma.job.findMany({
      where: {
        status: "PENDING",
        lockedBy: null,
        OR: [
          {
            retryScheduledFor: {
              lte: now,
            },
          },
          {
            retryScheduledFor: null,
          },
        ],
      },
      select: {
        id: true,
        url: true,
        keyword: true,
        platform: true,
        mode: true,
        requestedProxyRegion: true,
        debugMode: true,
        retryScheduledFor: true,
        createdAt: true,
      },
      take: 20,
      orderBy: [{ retryScheduledFor: "asc" }, { createdAt: "asc" }],
    });

    for (const job of scheduledJobs) {
      const retryWorkerJobId = this.generateJobId();

      const lockResult = await prisma.job.updateMany({
        where: {
          id: job.id,
          status: "PENDING",
          lockedBy: null,
          ...(job.retryScheduledFor
            ? {
                retryScheduledFor: {
                  lte: now,
                },
              }
            : { retryScheduledFor: null }),
        },
        data: {
          lockedBy: retryWorkerJobId,
          lockedAt: new Date(),
          workerJobId: retryWorkerJobId,
          retryScheduledFor: null,
        },
      });

      if (lockResult.count === 0) {
        continue;
      }

      console.log(
        `\x1b[36m[WORKER ${this.workerId}] Picking job ${job.id} (retry=${job.retryScheduledFor ? "yes" : "no"})\x1b[0m`,
      );

      void this.executeCrawl(retryWorkerJobId, job.url ?? undefined, {
        clientJobId: job.id,
        keyword: job.keyword ?? undefined,
        platform: job.platform,
        mode: job.mode,
        proxyRegion: job.requestedProxyRegion,
        debugMode: job.debugMode,
        preLocked: true,
      }).catch((error) => {
        console.error(
          `Retry execution ${retryWorkerJobId} failed:`,
          error?.message ?? error,
        );
      });
    }
  }

  private async processHardTimeouts(): Promise<void> {
    const prisma = getPrisma();
    const staleCutoff = new Date(Date.now() - this.hardTimeoutMs);

    const staleJobs = await prisma.job.findMany({
      where: {
        status: "RUNNING",
        lastHeartbeatAt: {
          lt: staleCutoff,
        },
      },
      select: {
        id: true,
      },
      take: 100,
    });

    if (staleJobs.length === 0) {
      return;
    }

    await prisma.job.updateMany({
      where: {
        status: "RUNNING",
        lastHeartbeatAt: {
          lt: staleCutoff,
        },
      },
      data: {
        status: "FAILED",
        blockedReason: "TIMEOUT",
        errorDetail: "Hard timeout: no heartbeat",
        finishedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
      },
    });

    for (const staleJob of staleJobs) {
      console.log(
        `\x1b[31m[TIMEOUT_KILL] Job ${staleJob.id} killed due to stale heartbeat\x1b[0m`,
      );
    }
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Add a new scrape job to the queue
   * Starts the crawl asynchronously and returns the jobId immediately
   */
  async addScrapeJob(
    url: string | undefined,
    options?: AddScrapeJobOptions,
  ): Promise<string> {
    const normalizedUrl = url?.trim() ?? "";
    const jobId = this.generateJobId();

    // Add initial pending status
    this.crawlQueue.set(jobId, {
      url: normalizedUrl,
      status: "pending",
      timestamp: Date.now(),
    });

    // Fire-and-forget crawl job
    this.executeCrawl(jobId, normalizedUrl || undefined, options).catch(
      (error) => {
        console.error(`Job ${jobId} failed:`, error.message);
      },
    );

    return jobId;
  }

  /**
   * Execute the actual crawl for a job
   */
  private async executeCrawl(
    jobId: string,
    url: string | undefined,
    options?: AddScrapeJobOptions,
  ): Promise<void> {
    const prisma = options?.clientJobId ? getPrisma() : null;
    const progressUpdater = createJobProgressUpdater({
      prisma,
      clientJobId: options?.clientJobId,
    });
    let stopProgressHeartbeat: (() => void) | null = null;

    try {
      const debugMode =
        options?.debugMode ?? process.env.CRAWLER_DEBUG_MODE === "true";
      const requestedProxyRegion = normalizeProxyRegion(options?.proxyRegion);
      const platform = normalizePlatform(options?.platform);
      const mode = normalizeCrawlMode(options?.mode);
      const keyword = options?.keyword?.trim() || undefined;
      const preLocked = options?.preLocked === true;

      if (prisma && options?.clientJobId && !preLocked) {
        const lockResult = await prisma.job.updateMany({
          where: {
            id: options.clientJobId,
            status: "PENDING",
            lockedBy: null,
          },
          data: {
            lockedBy: jobId,
            lockedAt: new Date(),
            workerJobId: jobId,
          },
        });

        if (lockResult.count === 0) {
          throw new ScraperError(
            "UNKNOWN",
            "Job lock acquisition failed: already locked or not PENDING",
          );
        }
      }

      const selectedProxy = prisma
        ? await selectProxyForRegion({
            prisma,
            proxyRegion: requestedProxyRegion,
          })
        : null;

      if (prisma && options?.clientJobId) {
        const startResult = await prisma.job.updateMany({
          where: {
            id: options.clientJobId,
            lockedBy: jobId,
          },
          data: {
            status: "RUNNING",
            startedAt: new Date(),
            errorMessage: null,
            errorDetail: null,
            blockedReason: null,
            lockedBy: jobId,
            lockedAt: new Date(),
            lastHeartbeatAt: new Date(),
            platform,
            mode,
            requestedProxyRegion,
            usedProxyId: selectedProxy?.id ?? null,
            usedProxyAddress: selectedProxy?.address ?? null,
            usedProxyPort: selectedProxy?.port ?? null,
            usedProxyRegion: selectedProxy?.region ?? null,
            progress: 5,
            debugMode,
          },
        });

        if (startResult.count === 0) {
          throw new ScraperError(
            "UNKNOWN",
            "Job start failed: lock owner mismatch",
          );
        }
      }

      let heartbeatProgress = 10;
      if (prisma && options?.clientJobId) {
        const heartbeat = setInterval(() => {
          if (heartbeatProgress < 45) {
            heartbeatProgress += 5;
          }

          // Keep sending heartbeats even at 45% so updatedAt stays fresh.
          void progressUpdater.updateProgress(heartbeatProgress);
        }, 15_000);

        stopProgressHeartbeat = () => {
          clearInterval(heartbeat);
        };
      }

      this.crawlQueue.set(jobId, {
        url: url ?? "",
        status: "running",
        timestamp: Date.now(),
      });

      logJobEvent("info", {
        jobId,
        platform: "generic",
        phase: "job",
        step: "start",
        message: "Job started",
        meta: {
          url,
          platform,
          mode,
          keyword,
          debugMode,
          requestedProxyRegion,
          usedProxy: selectedProxy
            ? {
                id: selectedProxy.id,
                address: selectedProxy.address,
                port: selectedProxy.port,
                region: selectedProxy.region,
              }
            : null,
        },
      });

      // Create isolated Dataset for this job
      const jobDataset = await Dataset.open(jobId);

      const scraper = createScraperStrategy({
        platform,
        mode,
        url,
      });

      if (mode === "DIRECT_URL" && !url) {
        throw new Error("DIRECT_URL mode requires URL");
      }

      if (mode === "SEARCH_KEYWORD" && !keyword) {
        throw new Error("SEARCH_KEYWORD mode requires keyword");
      }

      const seedUrl =
        url ??
        (platform === "GOOGLE"
          ? "https://www.google.com"
          : "https://www.facebook.com");

      const extracted = await scraper.execute({
        jobId,
        platform,
        mode,
        url: seedUrl,
        keyword,
        debugMode,
        proxy: selectedProxy ?? undefined,
        onProgress: async (progress, step) => {
          await progressUpdater.updateProgress(progress);

          if (step) {
            logJobEvent("info", {
              jobId,
              platform: scraper.platform,
              phase: "scrape",
              step,
              message: "Progress heartbeat from scraper loop",
              meta: { progress },
            });
          }
        },
      });

      if (stopProgressHeartbeat) {
        stopProgressHeartbeat();
        stopProgressHeartbeat = null;
      }

      await progressUpdater.updateProgress(70);

      // Push data to the job's isolated Dataset
      await jobDataset.pushData({
        jobId,
        platform: scraper.platform,
        ...extracted,
      });

      await progressUpdater.updateProgress(80);

      // Retrieve data from isolated Dataset
      const datasetResults = await jobDataset.getData();

      this.crawlQueue.set(jobId, {
        url: url ?? seedUrl,
        status: "done",
        result: datasetResults.items,
        timestamp: Date.now(),
      });

      if (prisma && options?.clientJobId) {
        const clientJobId = options.clientJobId;
        const artifacts = await collectArtifactPaths(jobId);

        await progressUpdater.updateProgress(90);

        await persistScrapedEntities({
          prisma,
          clientJobId,
          entities: extracted.entities,
        });

        const [profileCount, interactionCount] = await Promise.all([
          prisma.profile.count({ where: { jobId: clientJobId } }),
          prisma.interaction.count({ where: { jobId: clientJobId } }),
        ]);

        await prisma.job.update({
          where: { id: clientJobId },
          data: {
            status: "COMPLETED",
            progress: 100,
            leadCount: profileCount,
            processedCount: Math.max(
              datasetResults.items.length,
              interactionCount,
            ),
            finishedAt: new Date(),
            errorMessage: null,
            errorDetail: null,
            blockedReason: null,
            lockedBy: null,
            lockedAt: null,
            retryScheduledFor: null,
            lastHeartbeatAt: new Date(),
          },
        });

        if (artifacts.screenshots.length > 0) {
          await prisma.jobArtifact.createMany({
            data: artifacts.screenshots.map((artifactPath) => ({
              jobId: clientJobId,
              type: "SCREENSHOT" as const,
              path: artifactPath,
            })),
          });
        }

        if (artifacts.rawExtracts.length > 0) {
          await prisma.jobArtifact.createMany({
            data: artifacts.rawExtracts.map((artifactPath) => ({
              jobId: clientJobId,
              type: "RAW_EXTRACT" as const,
              path: artifactPath,
            })),
          });
        }
      }

      logJobEvent("info", {
        jobId,
        platform: scraper.platform,
        phase: "job",
        step: "complete",
        message: "Job completed",
        meta: { items: datasetResults.items.length },
      });

      // Clean up disk: remove dataset file after retrieving data
      await jobDataset.drop();

      if (debugMode) {
        await cleanupOldArtifacts(24 * 60 * 60 * 1000);
      }
    } catch (error: any) {
      if (stopProgressHeartbeat) {
        stopProgressHeartbeat();
        stopProgressHeartbeat = null;
      }

      const message = error?.message ?? "Job failed";
      const detail = error?.stack ? String(error.stack) : null;
      const blockedReason = resolveBlockedReason(error);

      this.crawlQueue.set(jobId, {
        url: url ?? "",
        status: "error",
        error: message,
        timestamp: Date.now(),
      });

      if (prisma && options?.clientJobId) {
        const clientJobId = options.clientJobId;
        const jobMeta = await prisma.job.findUnique({
          where: { id: clientJobId },
          select: {
            retryCount: true,
            maxRetry: true,
          },
        });

        const shouldAutoRetry =
          jobMeta !== null &&
          isAutoRetryableReason(blockedReason) &&
          jobMeta.retryCount < jobMeta.maxRetry;

        if (shouldAutoRetry) {
          const delayMs = computeRetryDelayMs(jobMeta.retryCount);
          const scheduledFor = new Date(Date.now() + delayMs);

          await prisma.job.update({
            where: { id: clientJobId },
            data: {
              status: "PENDING",
              progress: 0,
              retryCount: {
                increment: 1,
              },
              retryScheduledFor: scheduledFor,
              errorMessage: message,
              errorDetail: detail,
              blockedReason,
              startedAt: null,
              finishedAt: null,
              lockedBy: null,
              lockedAt: null,
              workerJobId: null,
              lastHeartbeatAt: new Date(),
            },
          });

          logJobEvent("warn", {
            jobId,
            platform: "generic",
            phase: "job",
            step: "auto-retry-scheduled",
            message: "Retry scheduled with exponential backoff",
            meta: {
              blockedReason,
              delayMs,
              retryCount: jobMeta.retryCount + 1,
              maxRetry: jobMeta.maxRetry,
              retryScheduledFor: scheduledFor.toISOString(),
            },
          });

          console.log(
            `\x1b[33m[RETRY] Job ${clientJobId} scheduled for ${scheduledFor.toISOString()}\x1b[0m`,
          );
        } else {
          await prisma.job.update({
            where: { id: clientJobId },
            data: {
              status: "FAILED",
              progress: 100,
              errorMessage: message,
              errorDetail: detail,
              blockedReason,
              finishedAt: new Date(),
              lockedBy: null,
              lockedAt: null,
              retryScheduledFor: null,
              lastHeartbeatAt: new Date(),
            },
          });
        }
      }

      logJobEvent("error", {
        jobId,
        platform: "generic",
        phase: "job",
        step: "error",
        message,
      });
    } finally {
      if (stopProgressHeartbeat) {
        stopProgressHeartbeat();
      }
    }
  }

  /**
   * Get the status and result of a scrape job
   */
  getJobStatus(jobId: string): ScrapeJob | null {
    const job = this.crawlQueue.get(jobId);
    return job || null;
  }
}

// Export singleton instance
export const scraperService = new ScraperService();
