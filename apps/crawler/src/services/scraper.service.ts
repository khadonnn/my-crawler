import { PlaywrightCrawler, Dataset } from "crawlee";

export interface ScrapeJob {
  url: string;
  status: "pending" | "running" | "done" | "error";
  result?: any;
  error?: string;
  timestamp: number;
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
  async addScrapeJob(url: string): Promise<string> {
    const jobId = this.generateJobId();

    // Add initial pending status
    this.crawlQueue.set(jobId, {
      url,
      status: "pending",
      timestamp: Date.now(),
    });

    // Fire-and-forget crawl job
    this.executeCrawl(jobId, url).catch((error) => {
      console.error(`Job ${jobId} failed:`, error.message);
    });

    return jobId;
  }

  /**
   * Execute the actual crawl for a job
   */
  private async executeCrawl(jobId: string, url: string): Promise<void> {
    try {
      this.crawlQueue.set(jobId, {
        url,
        status: "running",
        timestamp: Date.now(),
      });

      // Create isolated Dataset for this job
      const jobDataset = await Dataset.open(jobId);

      const crawler = new PlaywrightCrawler({
        browserPoolOptions: {
          retireBrowserAfterPageCount: 10,
        },
        maxRequestsPerCrawl: 1,
        requestHandlerTimeoutSecs: 30,
        headless: true,

        async requestHandler({ page, request, log }) {
          log.info(`[${jobId}] Crawling: ${request.loadedUrl}`);

          await page.waitForLoadState("networkidle", { timeout: 15000 });

          const title = await page.title();
          const content = await page.locator("body").innerText();

          // Push data to the job's isolated Dataset
          await jobDataset.pushData({
            jobId,
            url: request.loadedUrl,
            title,
            previewSnippet: content.substring(0, 300) + "...",
            crawledAt: new Date().toISOString(),
          });
        },
      });

      await crawler.run([url]);

      // Retrieve data from isolated Dataset
      const datasetResults = await jobDataset.getData();

      this.crawlQueue.set(jobId, {
        url,
        status: "done",
        result: datasetResults.items,
        timestamp: Date.now(),
      });

      // Clean up disk: remove dataset file after retrieving data
      await jobDataset.drop();
    } catch (error: any) {
      this.crawlQueue.set(jobId, {
        url,
        status: "error",
        error: error.message,
        timestamp: Date.now(),
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
