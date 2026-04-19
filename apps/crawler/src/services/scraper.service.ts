import fs from "node:fs/promises";
import path from "node:path";

import { getPrisma } from "@scraping-platform/db";
import { Dataset } from "crawlee";
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
};

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

      if (prisma && options?.clientJobId) {
        await prisma.job.update({
          where: { id: options.clientJobId },
          data: {
            status: "RUNNING",
            startedAt: new Date(),
            errorMessage: null,
            blockedReason: null,
            workerJobId: jobId,
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
        meta: { url, debugMode },
      });

      // Create isolated Dataset for this job
      const jobDataset = await Dataset.open(jobId);

      const scraper = createScraperForUrl(url);
      const extracted = await scraper.execute({
        jobId,
        url,
        debugMode,
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

        await prisma.job.update({
          where: { id: clientJobId },
          data: {
            status: "COMPLETED",
            progress: 100,
            processedCount: datasetResults.items.length,
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
