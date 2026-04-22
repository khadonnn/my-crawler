import { Worker, Job } from "bullmq";
import { QUEUE_NAMES } from "./queue.constants";
import { redisConnection } from "./connection";
import { CrawlJobPayload } from "./queue.types";

export function createCrawlWorker(
  processor: (job: Job<CrawlJobPayload>) => Promise<void>,
) {
  return new Worker<CrawlJobPayload>(
    QUEUE_NAMES.CRAWL,
    async (job) => {
      await processor(job);
    },
    {
      connection: redisConnection,
      concurrency: 5,
    },
  );
}
