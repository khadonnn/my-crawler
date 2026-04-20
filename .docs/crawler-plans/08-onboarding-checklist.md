# 08 - Onboarding Checklist

## Mục tiêu

- Tạo một checklist onboarding ngay trên dashboard để user hiểu rõ flow scraping.
- Dẫn user qua các bước: cấp quyền truy cập, tạo crawler, chạy thu thập, xem dữ liệu.
- Dùng dữ liệu thật từ Prisma để badge trạng thái Done/Pending.

## Phạm vi

- Tạo Server Component mới tại `apps/web/components/dashboard/getting-started-checklist.tsx`.
- Query trực tiếp các chỉ số:
  - số account ACTIVE
  - tổng số job
  - số job COMPLETED
  - tổng số interaction
- Render 4 bước cùng progress bar.
- Đặt component ở đầu `apps/web/app/page.tsx`.
- Nâng `growth-chart.tsx` để có chiều cao tối thiểu rõ ràng trên dashboard.

## Checklist

- [x] Tạo component checklist
- [x] Tích hợp dữ liệu Prisma
- [x] Chèn component vào dashboard home
- [x] Sửa minHeight chart
- [x] Chạy build kiểm tra TypeScript
