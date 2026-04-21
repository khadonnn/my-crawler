# ACTIVE TASK

## Current Focus

- Final production hardening (durable retry + timeout semantics + operator controls) is completed:
  - Worker now runs periodic durable retry pickup from DB (`retryScheduledFor <= now`) instead of volatile in-memory delayed retry.
  - Worker now enforces hard timeout from `lastHeartbeatAt` and marks stale `RUNNING` jobs as `FAILED/TIMEOUT`.
  - Manual retry API `POST /api/jobs/[jobId]/retry` added with policy checks:
    - only `FAILED` jobs,
    - reject when `retryCount >= maxRetry`,
    - keep retry history (`retryCount/maxRetry`) intact.
  - Crawlers console now has `Retry` button (disabled when exhausted) and still keeps `Rerun` as separate behavior.
  - Datasets job detail now includes timeline block (`created/started/heartbeat/update/finished/retry-scheduled/lock`).

- Package 2 (runtime core) is completed:
  - Worker-side locking to prevent concurrent execution collisions.
  - Heartbeat field (`lastHeartbeatAt`) refreshed on progress writes.
  - Stale job cleanup endpoint `POST /api/jobs/sweep` for no-heartbeat failures.

- Package 1 (Production foundation) is completed:
  - Database schema upgraded with lock, heartbeat, retry and typed blocked reason fields.
  - Typed scraper error classification integrated into Facebook direct/search strategies.
  - Build and Prisma generation validated successfully.

- Progress tracking for long-running jobs is now complete with:
  - Real-time progress bar (0-100%) with heartbeat every 15 seconds.
  - ETA countdown updated in real-time on the Datasets page.
  - Stuck job detection (RUNNING > 5 min no update) with delete action.
  - Visual "alive" heartbeat animation when progress is 0%.
- All pending improvements resolved; app is in stable working state.
- Proxy onboarding flow is now added to the dashboard and proxies pages with a 5-step navigation path.

## Next Step

- Add scheduler/cron invocation for `POST /api/jobs/sweep` in production runtime.
- Add small E2E smoke script to verify: failed -> retry scheduled -> worker restart -> retry still executes.

- Review whether the onboarding flow should also add a CTA on `/accounts` and `/crawlers` for a fully chained route experience.
- Add full extraction logic for `FacebookSearchStrategy` (collect result posts/comments/reactions from search results).
- Implement the first non-Facebook search strategy (Google Search or YouTube Search).
- Extend job history table to show progress bar inline (if time permits).
- Refactor any remaining backward-compat routes if schema feels too complex.

## Notes for Resume

- If the next session says "Resume work", read `FEATURES_DONE.md`, `ACTIVE_TASK.md`, and the latest plan file first.
- Current issue tracker: All major features working. Progress bar verified with multiple jobs hitting 45% (heartbeat capped, awaiting stage completion).
- To test: Create new job at `/crawlers` → Click "View Data" → Navigate to `/datasets?jobId=<new-id>` → Watch progress bar increment every 15s.

##

tôi khi crawl data public trên facebook ví dụ từ reaction của những post nào đó thoả keyword tìm kiếm, hoặc comment từ bài viết, thì bảng của mình sẽ cần những cột gì ? nếu crawl thông tin người dùng public như sống ở đâu, từ quê nào, nam hay nữ, instagram hay các properties khác. Bạn góp ý giúp tôi để xây dựng shema prisma từ link doc: https://www.prisma.io/docs/prisma-orm/quickstart/prisma-postgres ; file shcema.prisma của họ: generator client {
provider = "prisma-client"
output = "../generated/prisma"
}

datasource db {
provider = "postgresql"
} , // 1. Bảng lưu trữ Bài Viết (Source)
// Lưu lại nguồn gốc nơi bạn quét được khách hàng để sau này phân tích ROI của keyword
model Post {
id String @id @default(uuid())
fbPostId String @unique // ID gốc của bài viết trên FB
postUrl String
authorName String // Tên Fanpage hoặc Group
content String? @db.Text
keywordMatched String? // Keyword nào đã kích hoạt việc cào bài này
scrapedAt DateTime @default(now())

interactions Interaction[]
}

// 2. Bảng lưu trữ Thông Tin Người Dùng (Leads)
// Lưu trữ các properties public phục vụ cho việc profiling
model Profile {
id String @id @default(uuid())
fbUid String @unique // User ID gốc của Facebook
name String
profileUrl String

// Các thông tin public (Có thể rỗng nếu user khóa profile)
gender String? // Nam / Nữ / Khác
currentCity String? // Nơi sống hiện tại
hometown String? // Quê quán
workplace String? // Nơi làm việc (Rất quan trọng để đánh giá lead)
education String? // Trường học

// Cross-platform links
instagramUrl String?
otherLinks Json? // Lưu mảng các link khác (Tiktok, Website cá nhân...)

// Metadata cho hệ thống
isProfileScraped Boolean @default(false) // Đánh dấu xem đã cho bot vào tận tường nhà quét chưa
leadScore Int @default(0) // Điểm đánh giá tiềm năng dựa trên AI
lastUpdated DateTime @updatedAt

interactions Interaction[]
}

// 3. Bảng lưu trữ Hành Vi (Reactions & Comments)
// Bảng trung gian nối Profile và Post
model Interaction {
id String @id @default(uuid())
type String // "REACTION" hoặc "COMMENT"

// Dành cho Reaction
reactionType String? // "LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY"

// Dành cho Comment
commentText String? @db.Text

// Khóa ngoại
profileId String
postId String
profile Profile @relation(fields: [profileId], references: [id])
post Post @relation(fields: [postId], references: [id])

interactedAt DateTime? // Thời gian user comment (nếu lấy được)
scrapedAt DateTime @default(now())

@@index([profileId])
@@index([postId])
}
