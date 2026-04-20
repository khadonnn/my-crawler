import { Request, Response } from "express";
import { scraperService } from "../services/scraper.service.js";

/**
 * Handle POST /api/scrape requests
 * Validates the URL and initiates a scrape job
 */
export async function handleScrape(req: Request, res: Response): Promise<void> {
  const { url, debugMode, clientJobId, proxyRegion } = req.body as {
    url?: string;
    debugMode?: boolean;
    clientJobId?: string;
    proxyRegion?: "ANY" | "VN" | "US";
  };

  // Validate URL format
  if (!url || !/^https?:\/\//.test(url)) {
    res.status(400).json({ error: "URL không hợp lệ" });
    return;
  }

  try {
    const jobId = await scraperService.addScrapeJob(url, {
      debugMode,
      clientJobId,
      proxyRegion,
    });

    res.status(202).json({
      success: true,
      jobId,
      message: "Crawl started. Poll /api/status/:jobId for results.",
    });
  } catch (error: any) {
    console.error("Error creating scrape job:", error.message);
    res.status(500).json({
      error: "Không thể tạo tác vụ crawl",
    });
  }
}

/**
 * Handle GET /api/status/:jobId requests
 * Returns the status and result of a scrape job
 */
export function handleStatus(req: Request, res: Response): void {
  const jobId = req.params.jobId as string;

  const job = scraperService.getJobStatus(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found or expired" });
    return;
  }

  res.json(job);
}

/**
 * Handle GET /api/health requests
 * Returns the health status of the service
 */
export function handleHealth(_req: Request, res: Response): void {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
}
