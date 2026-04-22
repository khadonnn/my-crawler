1. apps/web (Producer)
   📂 Cấu trúc tối thiểu
   apps/web/
   ├── src/
   │ ├── app/api/jobs/route.ts
   │ ├── services/job.service.ts
   │ └── lib/db.ts
   📍 API tạo Job (route.ts)
   import { NextRequest, NextResponse } from "next/server";
   import { crawlQueue } from "@scraper/queue";
   import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
const body = await req.json();

const {
platform,
mode,
url,
keyword,
selectedProxyId,
targetCountry,
} = body;

// 1. Tạo job trong DB trước
const job = await db.job.create({
data: {
platform,
mode,
url,
keyword,
selectedProxyId,
targetCountry,
status: "PENDING",
},
});

// 2. Đẩy vào queue
await crawlQueue.add("crawl", {
jobId: job.id,
platform,
mode,
url,
keyword,
selectedProxyId,
targetCountry,
});

return NextResponse.json({
success: true,
jobId: job.id,
});
}
📍 Service tạo job (optional clean code)
import { crawlQueue } from "@scraper/queue";
import { db } from "@/lib/db";

export async function createCrawlJob(payload: any) {
const job = await db.job.create({
data: {
...payload,
status: "PENDING",
},
});

await crawlQueue.add("crawl", {
jobId: job.id,
...payload,
});

return job;
}
📍 UI gọi API
await fetch("/api/jobs", {
method: "POST",
body: JSON.stringify({
platform: "FACEBOOK",
mode: "SEARCH_KEYWORD",
keyword: "bất động sản",
}),
});
🧱 2. apps/crawler (Worker)
📂 Cấu trúc
apps/crawler/
├── src/
│ ├── worker.ts
│ ├── services/
│ │ └── scraper.service.ts
│ ├── factories/
│ │ └── scraper.factory.ts
│ └── lib/db.ts
📍 worker.ts (ENTRY POINT)
import { createCrawlWorker } from "@scraper/queue";
import { scraperService } from "./services/scraper.service";
import { db } from "./lib/db";

createCrawlWorker(async (job) => {
const { jobId } = job.data;

console.log("[WORKER] Start:", jobId);

// 1. Update trạng thái RUNNING
await db.job.update({
where: { id: jobId },
data: {
status: "RUNNING",
startedAt: new Date(),
},
});

try {
// 2. Execute scraper
await scraperService.execute(job.data, job);

    // 3. DONE
    await db.job.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
      },
    });

    console.log("[WORKER] DONE:", jobId);

} catch (err) {
console.error("[WORKER] FAIL:", jobId, err);

    await db.job.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorDetail: String(err),
      },
    });

    throw err; // để BullMQ retry

}
});
📍 scraper.service.ts
import { CrawlJobPayload } from "@scraper/queue";
import { scraperFactory } from "../factories/scraper.factory";

export const scraperService = {
async execute(payload: CrawlJobPayload, job?: any) {
const scraper = scraperFactory.create(
payload.platform,
payload.mode
);

    // optional progress
    await job?.updateProgress(10);

    const result = await scraper.run(payload);

    await job?.updateProgress(80);

    return result;

},
};
🧠 3. scraper.factory.ts
export const scraperFactory = {
create(platform: string, mode: string) {
switch (platform) {
case "FACEBOOK":
return createFacebookScraper(mode);

      case "GOOGLE":
        return createGoogleScraper(mode);

      default:
        throw new Error("Unsupported platform");
    }

},
};
⚙️ 4. Chạy hệ thống
🐳 docker-compose (thêm Redis)
services:
postgres:
image: postgres:16-alpine
...

redis:
image: redis:7-alpine
ports: - "6379:6379"
▶️ Start system

# 1. start DB + Redis

docker compose up -d

# 2. chạy web

npm run dev --workspace=apps/web

# 3. chạy crawler worker

npm run dev --workspace=apps/crawler
🔥 Flow hoàn chỉnh
UI → /api/jobs
→ DB create job (PENDING)
→ queue.add()

Redis → Worker
→ scraperService
→ DB update RUNNING
→ crawl
→ DB update DONE
⚠️ Những thứ bạn nên làm NGAY sau template này

1. Heartbeat (tránh job chết ngầm)
   await db.job.update({
   where: { id: jobId },
   data: { lastHeartbeatAt: new Date() },
   });
2. Timeout per job

Bạn đã có rồi → integrate vào worker là xong

3. Proxy bắt buộc (kill switch)

Kết hợp với logic bạn đã viết trước đó

4. Incremental persist

Bạn đã làm rồi → chỉ cần giữ nguyên

✅ Kết luận

Template này giúp bạn:

✔ Web không còn crawl trực tiếp
✔ Worker chạy độc lập
✔ Retry tự động
✔ Scale nhiều worker
✔ Đúng kiến trúc SaaS crawler
