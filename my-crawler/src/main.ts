import express from "express";
import cors from "cors";
import scraperRoutes from "./routes/scraper.route.js";

const app = express();
const PORT = process.env.PORT || 10000;

/**
 * Middleware: CORS Configuration
 */
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ],
    credentials: true,
  }),
);

/**
 * Middleware: JSON Body Parser
 */
app.use(express.json());

/**
 * Mount the Scraper API Routes
 */
app.use("/api", scraperRoutes);

/**
 * Start the server
 */
const server = app.listen(PORT, () => {
  console.log(`🚀 Crawler Worker ready at http://localhost:${PORT}`);
});

/**
 * Graceful shutdown handlers
 */
process.on("SIGTERM", () => shutdown());
process.on("SIGINT", () => shutdown());

function shutdown(): void {
  console.log("🔄 Shutting down gracefully...");
  server.close(() => process.exit(0));
}
