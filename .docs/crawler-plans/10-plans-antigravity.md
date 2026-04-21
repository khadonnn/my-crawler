🔍 Phân Tích Trạng Thái Dự Án & Bước Tiếp Theo
✅ Tổng quan những gì đã hoàn thành

# Feature Status

1 Monorepo scaffold (Turborepo + npm workspaces) ✅ Done
2 Dashboard Bento + Charts (KPI, growth, quality, running tasks) ✅ Done
3 Crawlers Management Console (create/rerun/stop/view data) ✅ Done
4 Crawler Observability (logs, screenshots, OCR, retention) ✅ Done
5 Multi-Platform Strategy + Factory (FacebookDirect + FacebookSearch skeleton) ✅ Done
6 Cookie Injection (gen-session, account dashboard, session-aware crawler) ✅ Done
7 Login Wall Detection + Reactions Trigger + End-to-End UI ✅ Done
8 Onboarding Checklist (dashboard, proxies, flow) ✅ Done
9 Proxy Region End-to-End (DB → worker → UI) ✅ Done
10 Proxy Bulk Import (paste-and-import) ✅ Done
11 Production Foundation – Package 1 (DB schema + error classification) ✅ Done
12 Production Core Runtime – Package 2 (locking + heartbeat + sweep) ✅ Done
13 Smart Retry + Dashboard Error Visibility – Package 3 ✅ Done
14 Production Hardening Final (durable retry + manual retry + timeline) ✅ Done
15 Job Progress Tracking + Real-Time Visibility ✅ Done
📋 Danh sách "Next Step" từ ACTIVE_TASK.md

# Task Loại Mức ưu tiên

1 Scheduler/cron cho POST /api/jobs/sweep trong production Ops / DevOps 🟡 Medium
2 E2E smoke script: failed → retry scheduled → worker restart → retry executes Testing 🟡 Medium
3 CTA onboarding trên /accounts và /crawlers UX Polish 🟢 Low
4 Full extraction logic cho FacebookSearchStrategy ⭐ Core Feature 🔴 High
5 Implement non-Facebook strategy (Google/YouTube Search) ⭐ Core Feature 🔴 High
6 Job history table hiện progress bar inline UX Polish 🟢 Low
7 Refactor backward-compat routes nếu schema phức tạp Tech Debt 🟢 Low
📝 Ghi chú từ schema trong ACTIVE_TASK.md
ACTIVE_TASK.md cũng chứa một đề xuất schema Prisma mới cho việc crawl data Facebook (Post, Profile, Interaction). Tuy nhiên, khi đối chiếu với schema hiện tại trong packages/db/prisma/schema.prisma, schema này đã được implement rồi – các model Post, Profile, Interaction đều đã có đầy đủ các cột tương ứng.

🎯 Đề xuất bước tiếp theo (Ưu tiên)
Option A (Khuyến nghị): Hoàn thiện FacebookSearchStrategy
IMPORTANT

Đây là bước có impact cao nhất. Hiện tại FacebookSearchStrategy chỉ là skeleton – nó navigate đến trang search nhưng chưa có logic extract data thật. Hoàn thiện nó sẽ:

Cho phép user tìm kiếm bài viết theo keyword trên Facebook
Thu thập posts/comments/reactions từ kết quả search
Lưu vào DB qua các model Post, Profile, Interaction đã có sẵn
Scope cụ thể:

Implement page interaction: scroll kết quả search, click vào posts
Extract post data (author, content, reactions count, comments)
Extract profile data từ reaction/comment authors
Tạo Interaction records liên kết Profile ↔ Post
Wire kết quả qua ScrapeResult → DB persistence trong scraper.service.ts
Test với keyword thực tế
Option B: Implement Google/YouTube Search Strategy
Nếu bạn muốn mở rộng nền tảng thay vì đào sâu Facebook, có thể implement strategy mới:

GoogleSearchStrategy – tìm keyword, thu thập kết quả trang đầu
YouTubeSearchStrategy – tìm video, thu thập channel/comment
Option C: Production Ops (Cron + Smoke Test)
Nếu ưu tiên ổn định production:

Setup cron job gọi POST /api/jobs/sweep định kỳ
Viết E2E smoke test cho retry flow
💡 Khuyến nghị cuối cùng
TIP

Nên chọn Option A – hoàn thiện FacebookSearchStrategy – vì:

Tất cả infrastructure đã sẵn sàng (schema, factory, service orchestration)
Đây là core value của sản phẩm: crawl leads từ keyword search
Model Post/Profile/Interaction đã define đầy đủ, chỉ cần code extraction logic
Sau khi xong, toàn bộ flow keyword → search → extract → leads sẽ hoạt động end-to-end
Bạn muốn bắt đầu với bước nào?

## Implementation Plan Chosen

- Build Facebook search as a single inline job flow.
- Use URL-based Facebook posts search, collect at most 5 normalized post URLs, then crawl them sequentially.
- Reuse the existing Facebook direct crawler logic for each URL and merge all extracted entities into the current SEARCH_KEYWORD job output.
- Keep failures isolated per URL so one bad result does not stop the remaining crawls.
