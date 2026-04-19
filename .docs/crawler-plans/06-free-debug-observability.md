# 06 - Free-First Scraping Strategy + Debug Observability

## Mục tiêu

- Chọn hướng triển khai crawler "free hoàn toàn" (không phụ thuộc dịch vụ trả phí).
- Ưu tiên khả năng quan sát (observability) để debug nhanh khi Facebook đổi UI hoặc chặn truy cập.
- Tạo luồng xác minh dữ liệu "nhìn thấy được" để tin tưởng đầu ra (logs, screenshots, raw events).
- Có một PoC nhỏ để kiểm tra end-to-end trước khi mở rộng.

## Bài toán thực tế

Crawler chạy headless nên không nhìn thấy trực tiếp bằng mắt. Vì vậy cần:

- Log hành trình từng bước (bot đang ở đâu, làm gì, lấy được gì).
- Chụp ảnh màn hình ở các mốc quan trọng và khi lỗi.
- Ghi dữ liệu thô ngay khi trích xuất để đối chiếu.
- Thiết kế crawl depth theo tầng để kiểm soát chi phí và độ ổn định.

## Tiêu chí "free hoàn toàn"

- Runtime: local Docker + Node.js + Playwright/Crawlee (open-source).
- Storage: PostgreSQL local (Docker) + filesystem (`storage/`).
- Queue/scheduler: dùng DB polling hoặc cron nội bộ (không cần Redis Cloud).
- Monitoring: logs file + API logs + screenshots + dashboard tự xây.
- Không dùng API trả phí, không dùng SaaS anti-bot trả phí trong giai đoạn đầu.

## Các phương án khả thi (free)

### 1) "Mắt thần" số 1: Terminal Logs + Screenshots (Khuyến nghị áp dụng ngay)

Ý tưởng:

- Worker phát log liên tục theo từng phase: open url, scroll, extract, persist.
- Tại mỗi phase quan trọng, bot chụp screenshot lưu vào `storage/screenshots/<jobId>/`.
- Khi lỗi (`try/catch`), luôn chụp thêm ảnh `error-*.png` + lưu `page.url()` + message lỗi.

Điểm mạnh:

- Miễn phí 100%.
- Debug cực nhanh vì thấy trạng thái thực tế của trang.
- Dễ tích hợp vào dashboard logs hiện có.

Điểm yếu:

- Tốn disk nếu không có retention policy.
- Cần chuẩn hóa format log để dễ tìm kiếm.

Khi dùng:

- Dùng ngay cho mọi job trong MVP.

### 2) DOM Snapshot + Raw Extract JSON (Nên bổ sung)

Ý tưởng:

- Ngoài screenshot, lưu thêm một phần HTML snapshot của vùng feed tại thời điểm extract.
- Lưu `rawExtract.json` để biết bot đọc được gì trước khi map vào schema.

Điểm mạnh:

- So sánh nhanh giữa selector cũ/mới khi UI thay đổi.
- Có bằng chứng rõ ràng để kiểm tra đúng-sai.

Điểm yếu:

- Dữ liệu nhiều, cần giới hạn số mẫu snapshot.

Khi dùng:

- Chỉ bật ở `debugMode=true`.

### 3) Live Debug Stream lên Dashboard (Nên làm sau PoC)

Ý tưởng:

- Mỗi khi bot tìm thấy post/profile/comment, gửi event về web app (`/api/logs/ingest`).
- Tab Logs hiển thị dạng timeline:
  - `[22:30] Found Post: ...`
  - `[22:31] Found Profile: ...`

Điểm mạnh:

- Quan sát realtime, phù hợp vận hành.
- Dễ thuyết phục về tính đúng đắn.

Điểm yếu:

- Cần thêm pipeline event + tránh spam quá nhiều records.

Khi dùng:

- Sau khi script nền ổn định.

## Đề xuất kiến trúc crawl depth (kiểu "rễ cây")

### Tầng 1: Group/Post Discovery

- Vào URL group public.
- Scroll 3-10 vòng (configurable).
- Lấy danh sách post cơ bản: `postUrl`, `content`, `author`, `timestamp`.

### Tầng 2: Interaction Discovery

- Với từng post, mở comment/reaction panel (nếu khả dụng).
- Thu danh sách user đang tương tác (`profileUrl`, `name`, `interactionType`).

### Tầng 3: Profile Enrichment

- Vào từng profile public để lấy thông tin mở:
  - `currentCity`, `hometown`, `workplace`, `education`, `instagramUrl`, `otherLinks`.
- Tính điểm `leadScore` theo rule-based scoring trước (chưa cần AI trả phí).

Nguyên tắc an toàn:

- Có thể dừng ở bất kỳ tầng nào qua config.
- Giới hạn số lượng item theo mỗi tầng (`maxPosts`, `maxProfilesPerPost`).
- Có `abort signal` để nút Stop trên dashboard dừng được job.

## Thiết kế Debug Mode trên Dashboard

`debugMode=true` cho job sẽ bật:

- Event stream theo bước (`INFO`, `WARN`, `ERROR`).
- Lưu screenshot theo phase.
- Lưu sample raw extract (N bản đầu tiên).
- Bảng đối chiếu:
  - `raw.author` -> `Profile.name`
  - `raw.content` -> `Post.content`
  - `raw.profileUrl` -> `Profile.profileUrl`

KPI debug cần có:

- `extract_success_rate = extracted_items / seen_items`
- `selector_fail_count`
- `captcha_or_login_wall_count`
- `avg_ms_per_post`

## Script PoC đề xuất (đúng theo yêu cầu hiện tại)

Mục tiêu PoC:

- Vào 1 group public.
- Scroll 3 lần.
- Lấy tên tác giả + nội dung bài viết.
- In ra terminal để kiểm tra nhanh.

Pseudo flow:

1. `goto(groupUrl)`
2. `for i in 1..3: mouse.wheel(0, 2500); wait random 1-2s`
3. `$$eval('div[role="feed"] > div', ...)` để map `author`, `content`, `timestamp`
4. `console.log` theo format có `jobId`
5. `page.screenshot()` cuối job

## Khuyến nghị triển khai theo phase

### Phase A (1-2 ngày): PoC nhìn thấy được

- Thêm log chuẩn hóa có `jobId`, `phase`, `step`, `url`.
- Thêm screenshot khi bắt đầu, sau scroll, sau extract, khi lỗi.
- Chạy thử với 1 group public, xác nhận log có dữ liệu thật.

### Phase B (2-3 ngày): Dữ liệu tin cậy

- Lưu raw extract mẫu + mapping vào DB.
- Thêm chỉ số extract success rate.
- Thêm cơ chế retry selector fallback.

### Phase C (2-4 ngày): Debug dashboard

- API ingest logs/events.
- Trang Logs realtime cho từng job.
- Nút mở nhanh thư mục screenshot theo `jobId`.

## Rủi ro và cách giảm thiểu

- Login wall/Captcha:
  - Phát hiện bằng selector + chụp ảnh lỗi + đánh dấu trạng thái `FAILED_BLOCKED`.
- Selector drift (FB đổi UI):
  - Dùng nhiều selector fallback, log selector nào match.
- Quá tải tài nguyên:
  - Giới hạn concurrency thấp, bật retention xóa screenshot cũ.
- Tuân thủ pháp lý/điều khoản:
  - Chỉ thu thập dữ liệu công khai, minh bạch mục đích sử dụng, có cơ chế xóa dữ liệu theo yêu cầu.

## Kết luận lựa chọn

Phương án phù hợp nhất cho giai đoạn hiện tại: kết hợp (1) Terminal Logs + Screenshots làm nền tảng bắt buộc, sau đó mở rộng (2) Raw snapshot và (3) Live debug stream.

Lý do:

- Free 100%.
- Triển khai nhanh, hiệu quả debug cao.
- Tạo niềm tin dữ liệu trước khi scale depth crawl.

## Checklist thực thi

- [ ] Chuẩn hóa logger cho worker theo `jobId/phase/step`.
- [ ] Thêm utility chụp screenshot theo phase + khi lỗi.
- [ ] Thêm cờ `debugMode` trong payload tạo job.
- [ ] Viết script PoC: group public -> scroll 3 lần -> log author/content.
- [ ] Chạy thử và lưu artifact mẫu (log + ảnh + raw json).
- [ ] Đánh giá độ ổn định selector trước khi mở rộng tầng 2/3.
