# ACTIVE TASK

## Current Focus

- External file-based memory system initialized for the Scraping Platform MVP.
- Scraper Worker architecture is documented under `.docs/system-design/`.
- Monorepo scaffold has been created with `apps/web`, `apps/crawler`, `packages/db`, and `packages/shared`.
- PostgreSQL Docker and Turbo workspace orchestration are now in place.
- Dashboard home page has been upgraded to a Bento command center with KPI cards, charts, running task monitor, and quick launch.
- Web APIs for dashboard telemetry are in place: worker health, proxy health, and aggregated dashboard metrics.
- Prisma schema now includes a `Proxy` model for proxy pool monitoring.
- Proxy bulk import now supports paste-and-import for `ip:port:user:pass` lists, including semicolon-delimited input and duplicate-safe bulk insert.
- Proxy import UX now uses toast notifications and closes modal on successful response; proxy list screen now surfaces `/api/proxies` fetch errors with retry.
- Crawlers management console is now live on `/crawlers` with advanced create form, job history table, and actions for rerun/stop/view-data.
- Jobs API surface has been extended with listing and control endpoints: `/api/jobs`, `/api/jobs/[jobId]/rerun`, `/api/jobs/[jobId]/stop`.
- Multi-platform architecture direction has been documented in `.docs/crawler-plans/07-multi-platform-strategy-refactor.md`.
- Observability phase is now wired into the crawler worker with structured job logs, debug screenshots, raw extract artifacts, and retention cleanup.
- Per-job `debugMode` is now plumbed from Web UI/API to Worker execution (including optional rerun override).
- OCR observability is now integrated in Facebook PoC: screenshot -> OCR text extraction -> persisted OCR artifact file for audit.
- Storage bootstrap is now present in repo with `.gitkeep` placeholders and ignore rules for runtime artifacts.
- Cookie Injection foundation is now in place: `Account` model, interactive session generator, and `POST /api/accounts` ingestion API.
- Prisma env loading is now workspace-aware, so `DATABASE_URL` can be resolved from the repo root when `apps/web` starts in a subdirectory.
- Cookie import UI is now available with modal-based account session submission and client-side JSON validation.
- Account management dashboard is now live at `/accounts` with list/update/delete actions.
- Facebook scraper is now session-aware: loads ACTIVE account session before crawl, falls back to anonymous if unavailable, and updates `lastUsedAt`.
- Session validation is now in place: detected Facebook login walls auto-mark account status as `EXPIRED`.
- Dashboard crawl trigger for reactions is now available via `POST /api/crawl/reactions`.
- Datasets UI now supports end-to-end `View Reactions` flow with auto-trigger crawl and refetch-after-completion.
- Dashboard now has an onboarding checklist component that explains the scraping flow and shows progress from real Prisma counts.
- Onboarding checklist now fails soft in dev when `DATABASE_URL` is missing, so the dashboard no longer crashes before env setup.

## Next Step

- Persist and display reactions/comments reliably after crawl completes (worker extraction -> DB writeback for `Interaction`).

## Notes for Resume

- If the next session says "Resume work", read `FEATURES_DONE.md`, `ACTIVE_TASK.md`, and the latest plan file first.

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
