# 🕷️ Tài liệu Kiến trúc Hệ thống Scraping (MVP Release)

## 1. Tổng quan Hệ thống

Hệ thống được thiết kế theo kiến trúc Microservices để đảm bảo hiệu năng và khả năng mở rộng (sẵn sàng scale cho các tác vụ Lead Generation đa nền tảng).

Bao gồm 2 module chính hoạt động độc lập:

1. **Frontend Dashboard (Port 3000):** Giao diện quản trị xây dựng bằng Next.js (App Router), Tailwind CSS v4, và Shadcn/ui. Dùng để gửi yêu cầu cào và hiển thị kết quả.
2. **Scraper Worker (Port 10000):** Cỗ máy cào dữ liệu chạy ngầm, xây dựng bằng Express.js kết hợp Crawlee và Playwright. Tối ưu cho môi trường deploy (như Render).

---

## 2. Cấu trúc Thư mục (Root Workspace)

```text
craping_platform/
├── frontend-dashboard/    # Next.js App
│   ├── app/
│   └── components/ui/
│
└── my-crawler/            # Scraper Worker (Crawlee + Express)
    ├── src/
    │   └── main.ts        # Chứa logic API và xử lý Playwright
    ├── storage/           # Nơi Crawlee lưu tạm dữ liệu (Dataset)
    ├── tsconfig.json      # Đã fix lỗi rootDir
    └── package.json       # type: "module"
```
