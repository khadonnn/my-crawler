import fs from "node:fs/promises";
import path from "node:path";

import { getPrisma } from "@scraping-platform/db";
import { Dataset } from "crawlee";
import type {
  ProxyRegion,
  ScrapedEntities,
  SelectedProxyConfig,
} from "../scrapers/base/scraper.types.js";
import { createScraperForUrl } from "../scrapers/factory/scraper.factory.js";
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
};

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

  const whereClause =
    proxyRegion === "ANY"
      ? { status: { in: ["WORKING", "UNKNOWN"] as const } }
      : {
          status: { in: ["WORKING", "UNKNOWN"] as const },
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
        status: { in: ["WORKING", "UNKNOWN"] as const },
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

function detectBlockedReason(errorMessage: string): string | null {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes("captcha")) {
    return "CAPTCHA_WALL";
  }

  if (normalized.includes("login") || normalized.includes("sign in")) {
    return "LOGIN_WALL";
  }

  return null;
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

class ScraperService {
  private crawlQueue: Map<string, ScrapeJob> = new Map();

  constructor() {
    // Memory cleanup: Remove jobs older than 1 hour
    this.startMemoryCleanup();
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
    url: string,
    options?: AddScrapeJobOptions,
  ): Promise<string> {
    const jobId = this.generateJobId();

    // Add initial pending status
    this.crawlQueue.set(jobId, {
      url,
      status: "pending",
      timestamp: Date.now(),
    });

    // Fire-and-forget crawl job
    this.executeCrawl(jobId, url, options).catch((error) => {
      console.error(`Job ${jobId} failed:`, error.message);
    });

    return jobId;
  }

  /**
   * Execute the actual crawl for a job
   */
  private async executeCrawl(
    jobId: string,
    url: string,
    options?: AddScrapeJobOptions,
  ): Promise<void> {
    const prisma = options?.clientJobId ? getPrisma() : null;

    try {
      const debugMode =
        options?.debugMode ?? process.env.CRAWLER_DEBUG_MODE === "true";
      const requestedProxyRegion = normalizeProxyRegion(options?.proxyRegion);

      const selectedProxy = prisma
        ? await selectProxyForRegion({
            prisma,
            proxyRegion: requestedProxyRegion,
          })
        : null;

      if (prisma && options?.clientJobId) {
        await prisma.job.update({
          where: { id: options.clientJobId },
          data: {
            status: "RUNNING",
            startedAt: new Date(),
            errorMessage: null,
            blockedReason: null,
            workerJobId: jobId,
            requestedProxyRegion,
            usedProxyId: selectedProxy?.id ?? null,
            usedProxyAddress: selectedProxy?.address ?? null,
            usedProxyPort: selectedProxy?.port ?? null,
            usedProxyRegion: selectedProxy?.region ?? null,
            debugMode,
          },
        });
      }

      this.crawlQueue.set(jobId, {
        url,
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

      const scraper = createScraperForUrl(url);
      const extracted = await scraper.execute({
        jobId,
        url,
        debugMode,
        proxy: selectedProxy ?? undefined,
      });

      // Push data to the job's isolated Dataset
      await jobDataset.pushData({
        jobId,
        platform: scraper.platform,
        ...extracted,
      });

      // Retrieve data from isolated Dataset
      const datasetResults = await jobDataset.getData();

      this.crawlQueue.set(jobId, {
        url,
        status: "done",
        result: datasetResults.items,
        timestamp: Date.now(),
      });

      if (prisma && options?.clientJobId) {
        const clientJobId = options.clientJobId;
        const artifacts = await collectArtifactPaths(jobId);

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
            blockedReason: null,
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
      const message = error?.message ?? "Job failed";

      this.crawlQueue.set(jobId, {
        url,
        status: "error",
        error: message,
        timestamp: Date.now(),
      });

      if (prisma && options?.clientJobId) {
        await prisma.job.update({
          where: { id: options.clientJobId },
          data: {
            status: "FAILED",
            progress: 100,
            errorMessage: message,
            blockedReason: detectBlockedReason(message),
            finishedAt: new Date(),
          },
        });
      }

      logJobEvent("error", {
        jobId,
        platform: "generic",
        phase: "job",
        step: "error",
        message,
      });
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
