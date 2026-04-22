import { QueueEvents } from "bullmq";
import { QUEUE_NAMES } from "./queue.constants";
import { redisConnection } from "./connection";

export const crawlQueueEvents = new QueueEvents(QUEUE_NAMES.CRAWL, {
  connection: redisConnection,
});

crawlQueueEvents.on("completed", ({ jobId }) => {
  console.log(`[QUEUE] Job completed: ${jobId}`);
});

crawlQueueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error(`[QUEUE] Job failed: ${jobId}`, failedReason);
});
