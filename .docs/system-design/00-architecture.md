# 🕷️ Tài liệu Kiến trúc Hệ thống Scraping (MVP Release)

## 1. Tổng Quan Hệ Thống

Hệ thống nên được hiểu là một mô hình điều phối job, không phải một UI điều khiển trực tiếp crawler.

Hai phần chính:

1. **Frontend Dashboard (Next.js):** giao diện cho người dùng nhập link Facebook Group hoặc keyword, xem trạng thái job, và theo dõi dữ liệu đã crawl.
2. **Crawler Worker (Crawlee + Playwright):** tiến trình chạy ngầm, nhận job từ database, thực thi crawl, rồi cập nhật kết quả về PostgreSQL.

MVP này có thể dùng Postgres vừa làm nơi lưu trạng thái job, vừa làm nguồn dữ liệu kết quả. Điều này đơn giản, dễ vận hành, và phù hợp giai đoạn đầu.

---

## 2. Luồng Nghiệp Vụ Chuẩn

Luồng bạn mô tả là đúng và nên chuẩn hóa như sau:

1. Người dùng nhập `Facebook Group URL` hoặc `keyword` trên Dashboard và nhấn `Start Scraping`.
2. Next.js gọi API hoặc Server Action để tạo một bản ghi `Job` trong PostgreSQL với trạng thái `PENDING`.
3. Worker Crawlee chạy ngầm, định kỳ kiểm tra database để tìm job `PENDING`.
4. Khi có job phù hợp, worker đổi trạng thái sang `RUNNING` và bắt đầu crawl.
5. Trong quá trình crawl, worker cập nhật tiến độ, số lượng leads, lỗi, và timestamps về database.
6. Khi hoàn tất, worker đổi trạng thái job sang `COMPLETED` hoặc `FAILED` nếu có lỗi.
7. Người dùng refresh Dashboard để thấy kết quả đã được lưu vào các bảng dữ liệu.

### Ghi chú kiến trúc

- Với MVP, polling database là chấp nhận được.
- Nếu muốn scale tốt hơn sau này, có thể thay polling bằng queue hoặc Postgres `LISTEN/NOTIFY`.
- Dashboard không nên gọi trực tiếp Crawlee để crawl, vì như vậy sẽ làm UI phụ thuộc vào runtime của worker.

---

## 3. Cấu Trúc Logic

### 3.1 Dashboard

Dashboard là control plane cho người dùng:

- Tạo job mới.
- Hiển thị danh sách job, trạng thái, tiến độ.
- Hiển thị leads, posts, comments, reactions, profile data.
- Cho phép retry, pause, cancel job nếu cần.

### 3.2 Worker

Worker là execution plane:

- Nhận job từ DB.
- Crawl dữ liệu từ Facebook.
- Parse nội dung, phản ứng, comment, profile công khai.
- Ghi dữ liệu chuẩn hóa về DB.

### 3.3 Database

PostgreSQL là source of truth cho:

- Job lifecycle.
- Kết quả crawl.
- Tiến độ và lỗi.
- Quan hệ giữa post, profile, interaction, và lead.

---

## 4. Cấu Trúc Thư Mục (Root Workspace)

```text
craping_platform/
├── apps/
│   ├── web/               # Next.js Dashboard
│   └── crawler/           # Scraper Worker (Crawlee + Express)
│
├── packages/
│   ├── db/                # Prisma schema, client, migrations
│   └── shared/            # Shared types and constants
│
├── docker-compose.yml     # PostgreSQL local development
├── turbo.json             # Monorepo task orchestration
└── package.json           # npm workspaces root
```

---

## 5. Đề Xuất Prisma Schema

Với use case của bạn, nên tách riêng 4 nhóm dữ liệu:

### 5.1 `Job`

Lưu lệnh crawl do người dùng tạo.

Nên có các cột:

- `id`
- `sourceType` như `GROUP_URL` hoặc `KEYWORD`
- `sourceValue` là link hoặc keyword
- `status` với các giá trị `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`
- `progress` hoặc `processedCount`
- `leadCount`
- `errorMessage`
- `createdAt`, `startedAt`, `finishedAt`, `updatedAt`

### 5.2 `Post`

Lưu bài viết nguồn mà crawler tìm được.

Nên có:

- `fbPostId`
- `postUrl`
- `authorName`
- `content`
- `keywordMatched`
- `scrapedAt`

### 5.3 `Profile`

Lưu thông tin người dùng công khai đã thu được từ reaction/comment/profile page.

Nên có:

- `fbUid`
- `name`
- `profileUrl`
- `gender`
- `currentCity`
- `hometown`
- `workplace`
- `education`
- `instagramUrl`
- `otherLinks`
- `leadScore`
- `isProfileScraped`
- `lastUpdated`

### 5.4 `Interaction`

Lưu mối quan hệ giữa profile và post.

Nên có:

- `type` như `REACTION` hoặc `COMMENT`
- `reactionType`
- `commentText`
- `profileId`
- `postId`
- `interactedAt`
- `scrapedAt`

---

## 6. Góp Ý Về Schema Bạn Đề Xuất

Schema bạn đưa ra là đúng hướng cho MVP, nhưng nên chỉnh vài điểm:

1. `Profile` không nên ép mọi trường public thành bắt buộc, vì Facebook thường thiếu dữ liệu hoặc bị khóa profile.
2. `otherLinks` nên giữ dạng `Json` là hợp lý.
3. `Interaction.type` nên dùng enum thay vì `String` nếu muốn an toàn hơn.
4. Nên có bảng `Job` riêng để dashboard và worker cùng theo dõi trạng thái.
5. Nên có thêm khóa liên kết giữa `Job` và dữ liệu crawl để biết một job đã sinh ra những post/profile nào.

---

## 7. Khuyến Nghị Triển Khai MVP

Nếu làm gọn và chắc, thứ tự nên là:

1. Tạo bảng `Job`.
2. Tạo bảng `Post`, `Profile`, `Interaction`.
3. Cho Dashboard tạo job mới.
4. Cho Worker polling job `PENDING`.
5. Ghi tiến độ và kết quả về DB.

Sau đó mới cân nhắc thêm queue, retry policy, và scaling nhiều worker.
