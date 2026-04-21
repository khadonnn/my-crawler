import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import {
  handleScrape,
  handleStatus,
  handleHealth,
} from "../controllers/scraper.controller.js";

const router = Router();

// API key is optional in local/dev. If not provided, auth is disabled.
const API_KEY = process.env.CRAWLER_API_KEY?.trim();

/**
 * Authentication middleware
 * Validates the X-API-Key header
 */
const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!API_KEY) {
    next();
    return;
  }

  const key = req.headers["x-api-key"] as string | undefined;

  if (key !== API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
};

/**
 * Rate limiter middleware
 * Limits requests to 10 per 15 minutes
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Quá nhiều yêu cầu, vui lòng thử lại sau" },
});

/**
 * POST /api/scrape
 * Start a new scrape job
 * Requires authentication and rate limiting
 */
router.post("/scrape", authenticate, apiLimiter, handleScrape);

/**
 * GET /api/status/:jobId
 * Get the status of a scrape job
 * Requires authentication
 */
router.get("/status/:jobId", authenticate, handleStatus);

/**
 * GET /api/health
 * Health check endpoint (no authentication required)
 */
router.get("/health", handleHealth);

export default router;
