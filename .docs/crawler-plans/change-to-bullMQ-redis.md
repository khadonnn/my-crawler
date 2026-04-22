Cấu trúc package @scraper/queue
packages/queue/
├── package.json
├── tsconfig.json
└── src/
├── index.ts
├── connection.ts
├── queue.constants.ts
├── queue.types.ts
├── queue.factory.ts
├── worker.factory.ts
├── queue.events.ts
└── utils/
└── job-logger.ts
1️⃣ package.json
{
"name": "@scraper/queue",
"version": "1.0.0",
"main": "dist/index.js",
"types": "dist/index.d.ts",
"dependencies": {
"bullmq": "^5.76.0",
"ioredis": "^5.4.1"
}
}
2️⃣ connection.ts (Redis single source)
import { Redis } from "ioredis";

export const redisConnection = new Redis({
host: process.env.REDIS_HOST || "localhost",
port: Number(process.env.REDIS_PORT) || 6379,
maxRetriesPerRequest: null,
});
3️⃣ queue.constants.ts
export const QUEUE_NAMES = {
CRAWL: "crawl-jobs",
} as const;

export const JOB_NAMES = {
CRAWL: "crawl",
} as const;
4️⃣ queue.types.ts (QUAN TRỌNG NHẤT)
export type Platform =
| "FACEBOOK"
| "GOOGLE"
| "YOUTUBE"
| "TIKTOK"
| "VOZ"
| "TINHTE";

export type CrawlMode = "DIRECT_URL" | "SEARCH_KEYWORD";

export interface CrawlJobPayload {
jobId: string;

platform: Platform;
mode: CrawlMode;

url?: string;
keyword?: string;

selectedProxyId?: string;
targetCountry?: string;
}
5️⃣ queue.factory.ts (Producer dùng)
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "./queue.constants";
import { redisConnection } from "./connection";
import { CrawlJobPayload } from "./queue.types";

export const crawlQueue = new Queue<CrawlJobPayload>(
QUEUE_NAMES.CRAWL,
{
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
}
);
6️⃣ worker.factory.ts (Consumer dùng)
import { Worker, Job } from "bullmq";
import { QUEUE_NAMES } from "./queue.constants";
import { redisConnection } from "./connection";
import { CrawlJobPayload } from "./queue.types";

export function createCrawlWorker(
processor: (job: Job<CrawlJobPayload>) => Promise<void>
) {
return new Worker<CrawlJobPayload>(
QUEUE_NAMES.CRAWL,
async (job) => {
await processor(job);
},
{
connection: redisConnection,
concurrency: 5,
}
);
}
7️⃣ queue.events.ts (Observability)
import { QueueEvents } from "bullmq";
import { QUEUE_NAMES } from "./queue.constants";
import { redisConnection } from "./connection";

export const crawlQueueEvents = new QueueEvents(
QUEUE_NAMES.CRAWL,
{ connection: redisConnection }
);

crawlQueueEvents.on("completed", ({ jobId }) => {
console.log(`[QUEUE] Job completed: ${jobId}`);
});

crawlQueueEvents.on("failed", ({ jobId, failedReason }) => {
console.error(`[QUEUE] Job failed: ${jobId}`, failedReason);
});
8️⃣ utils/job-logger.ts (structured log)
export function logJobEvent(data: Record<string, any>) {
console.log(
JSON.stringify({
timestamp: new Date().toISOString(),
...data,
})
);
}
9️⃣ index.ts (export tất cả)
export _ from "./queue.types";
export _ from "./queue.constants";
export _ from "./queue.factory";
export _ from "./worker.factory";
export _ from "./queue.events";
export _ from "./connection";
🚀 Cách dùng
👉 apps/web (Producer)
import { crawlQueue } from "@scraper/queue";

await crawlQueue.add("crawl", {
jobId: "job-123",
platform: "FACEBOOK",
mode: "SEARCH_KEYWORD",
keyword: "bất động sản",
});
👉 apps/crawler (Worker)
import { createCrawlWorker } from "@scraper/queue";

createCrawlWorker(async (job) => {
console.log("Processing job:", job.data);

// gọi scraper của bạn ở đây
});
🔥 Bonus (rất nên làm)

1. Add priority job
   await crawlQueue.add("crawl", payload, {
   priority: 1,
   });
2. Delay job
   await crawlQueue.add("crawl", payload, {
   delay: 10000,
   });
3. Rate limit (anti-ban Facebook)
   new Worker(queueName, processor, {
   limiter: {
   max: 5,
   duration: 1000,
   },
   });
   ⚠️ Những lỗi bạn sẽ tránh được với setup này
   ❌ lệch queue name
   ❌ lệch payload type
   ❌ lệch retry config
   ❌ hardcode Redis nhiều chỗ
   ❌ debug không biết job fail ở đâu
   ✅ Kết luận

Template này:

✔ chuẩn SaaS crawler
✔ scale multi worker
✔ không lệch type giữa web & crawler
✔ dễ thêm queue mới sau này

Nếu bạn muốn, bước tiếp theo mình recommend:

👉 gắn luôn queue này vào scraper.service.ts của bạn
→ để có retry + timeout + fail-safe full system (rất đáng làm).
