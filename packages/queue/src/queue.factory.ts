import { Queue } from "bullmq";
import { QUEUE_NAMES } from "./queue.constants";
import { redisConnection } from "./connection";
import { CrawlJobPayload } from "./queue.types";

export const crawlQueue = new Queue<CrawlJobPayload>(QUEUE_NAMES.CRAWL, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
