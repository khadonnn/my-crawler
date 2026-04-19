# 04 - Dashboard Bento Chart

## Mục tiêu

- Biến trang chủ `/` thành trung tâm điều hành cho hệ thống scraping.
- Dùng bố cục bento grid để hiển thị KPI, biểu đồ, và danh sách tác vụ đang chạy.
- Ưu tiên thành phần tái sử dụng riêng cho dashboard, giữ phong cách shadcn/ui nhất quán.

## Phạm vi UI

### 1) KPI Cards

- Tổng số leads tìm thấy.
- Tỷ lệ proxy đang sống.
- Số task đang chạy.

### 2) Line Chart

- Biểu đồ lượng dữ liệu cào được theo từng ngày trong tuần.
- Dữ liệu mẫu tạm thời để tạo UI trước, sau đó có thể map sang dữ liệu thật từ DB.

### 3) Running Tasks

- Chỉ hiển thị các job đang chạy.
- Mỗi item cần có trạng thái, thời gian, và progress bar.

## Kế hoạch triển khai

- Tạo các component dashboard riêng trong `apps/web/components/dashboard/`.
- Thêm chart component theo phong cách shadcn/ui nếu repo chưa có sẵn.
- Refactor trang `apps/web/app/page.tsx` để ghép các component mới vào bố cục bento.
- Giữ fallback an toàn nếu DB chưa có dữ liệu thực tế.

## Ràng buộc

- Không thay đổi contract hiện có của Prisma trừ khi thật cần thiết cho UI.
- Không làm ảnh hưởng các trang con khác của dashboard.
- Ưu tiên tái sử dụng UI primitives hiện có trong `components/ui`.

## Checklist

- [x] Xác nhận hướng thiết kế với người dùng
- [x] Tạo component KPI cards
- [x] Tạo component line chart
- [x] Tạo component running tasks
- [x] Chèn các component vào trang chủ `/`
- [x] Kiểm tra build/lint cho app web

# update

Mục tiêu
Biến trang chủ / thành Trung tâm điều hành toàn diện cho hệ thống Scraping.

Áp dụng bố cục Bento Grid hiện đại để tối ưu hóa không gian hiển thị thông tin đa chiều.

Tích hợp các chỉ số thực tế về "Sức khỏe" Worker và "Phân tích hành vi"

- Kiến trúc Layout (Grid 4xN); Dựa trên hệ thống lưới (Grid System) của Tailwind v4, giao diện sẽ được chia như sau:
  Vị trí,Thành phần,Col Span,Tính năng chính
  Row 1,KPI Statistics,col-span-4,"4 thẻ nhỏ: Tổng Leads, Task chạy, Proxy sống, Worker Health."
  Row 2 (L),Growth Chart,col-span-3,Biểu đồ Line Chart thể hiện dữ liệu cào theo ngày/tuần.
  Row 2 (R),Quality Analysis,col-span-1,Pie Chart phân loại chất lượng Lead (Potential vs Neutral).
  Row 3 (L),Running Tasks,col-span-2,Danh sách Job đang chạy kèm Progress Bar thời gian thực.
  Row 3 (R),Quick Launch,col-span-2,Ô nhập URL nhanh để kích hoạt cào ngay lập tức.

🛠️ Phạm vi Chi tiết (UI Components)

1. KPI & System Health
   Leads Counter: Tổng hợp số lượng record từ bảng Profile và Post.

Worker Status: Trạng thái con Worker tại port 10000 (Sử dụng biểu tượng Dot nhấp nháy: Xanh - Online, Đỏ - Offline).

Proxy Monitor: Hiển thị phần trăm Proxy đang ở trạng thái Working.

2. Analytics (Recharts)
   Growth Line: Map dữ liệu createdAt từ bảng Job lên biểu đồ.

Sentiment/Lead Quality: Phân tích sơ bộ dựa trên leadScore trong bảng Profile để hiện thị tỉ lệ khách hàng tiềm năng.

3. Operational Features
   Task Monitor: Chỉ fetch các Job có status: "RUNNING". Tự động cập nhật % progress thông qua polling.

Instant Scraper: Input dán URL Facebook Group -> Gửi request trực tiếp tới Worker API.

🚀 Kế hoạch Triển khai
Phase 1: Infrastructure & Data Fetching
[ ] Cài đặt recharts và các component Chart của shadcn/ui.

[ ] Cấu hình SWR hoặc React Query tại apps/web để fetch dữ liệu real-time mỗi 10s.

[ ] Viết API route /api/proxy-health và /api/worker-health để lấy trạng thái hệ thống.

Phase 2: Component Development (/components/dashboard/)
[ ] kpi-cards.tsx: Hiển thị các chỉ số nhanh.

[ ] growth-chart.tsx: Biểu đồ tăng trưởng dữ liệu.

[ ] quality-pie.tsx: Phân tích chất lượng Lead.

[ ] running-tasks.tsx: Danh sách tác vụ đang xử lý.

[ ] quick-launch.tsx: Form ra lệnh cào nhanh.

Phase 3: Assembly & Refactor
[ ] Thay thế code cũ tại apps/web/app/page.tsx bằng bố cục Bento mới.

[ ] Kiểm tra Responsive (Ưu tiên hiển thị 1 cột trên Mobile, 4 cột trên Desktop).

⚠️ Ràng buộc & Lưu ý
Real-time: Sử dụng cơ chế Polling (Refresh interval) thay vì WebSocket để đơn giản hóa logic demo ban đầu.

Fallback: Luôn hiển thị trạng thái "Empty" hoặc "Skeleton" nếu Database trống hoặc Worker chưa bật.

Performance: Tối ưu hóa Server Components cho các dữ liệu tĩnh và Client Components cho các biểu đồ cần update liên tục.

## Kết quả triển khai

- Đã cài `recharts` và `swr` cho `apps/web`.
- Đã thêm API route: `/api/dashboard`, `/api/worker-health`, `/api/proxy-health`.
- Đã thêm `Proxy` model trong `packages/db/prisma/schema.prisma` và regenerate Prisma Client.
- Đã xây mới dashboard components theo Bento Grid 4 cột:
  - `kpi-cards.tsx`
  - `growth-chart.tsx`
  - `quality-pie.tsx`
  - `running-tasks.tsx`
  - `quick-launch.tsx`
- Đã refactor trang chủ `/` để dùng dashboard mới với polling 10s.
- Lint hiện còn 2 lỗi cũ ngoài phạm vi dashboard ở `MyClock.tsx` và `use-mobile.ts`.

# schema.prisma :

model Proxy {
id String @id @default(uuid())
address String // IP
port Int  
 username String?
password String?
protocol String @default("http")
status String @default("UNKNOWN") // WORKING, DEAD, UNKNOWN
latency Int @default(0) // Độ trễ ms
lastChecked DateTime @default(now())
createdAt DateTime @default(now())

@@unique([address, port])
}
