# 00 - Init Worker

## Mục tiêu

- Thiết lập Scraper Worker bằng Express + Crawlee + Playwright.
- Tách kiến trúc Router - Controller - Service để dễ bảo trì.
- Giữ nguyên contract API cho frontend Next.js.

## Trạng thái

- [x] Khởi tạo worker
- [x] Tách `main.ts` thành `routes/`, `controllers/`, `services/`
- [x] Sửa lỗi module resolution cho `NodeNext`

## Ghi chú kỹ thuật

- `scraper.service.ts` giữ toàn bộ crawl queue, cleanup RAM, và PlaywrightCrawler logic.
- `scraper.controller.ts` chỉ xử lý `Request`/`Response`.
- `scraper.route.ts` gắn middleware `authenticate` và `apiLimiter`.
- `main.ts` chỉ cấu hình Express, mount router và graceful shutdown.

## Bước tiếp theo

- Xây dashboard Next.js cho việc submit URL và xem trạng thái job.
