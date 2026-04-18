# 01 - Next.js UI

## Mục tiêu

- Xây giao diện dashboard cho Scraping Platform MVP.
- Tập trung vào form submit URL, trạng thái job, và vùng hiển thị kết quả.
- Dùng Shadcn/ui để giữ UI nhất quán và dễ mở rộng.

## Checklist

- [ ] Xác định layout chính của dashboard
- [ ] Thiết kế form nhập URL và API key
- [ ] Hiển thị trạng thái job theo polling
- [ ] Hiển thị dữ liệu crawl trả về từ worker
- [ ] Hoàn thiện trạng thái loading / error / empty

## Phụ thuộc

- Scraper Worker API phải ổn định.
- Contract `/api/scrape` và `/api/status/:jobId` không được thay đổi.
