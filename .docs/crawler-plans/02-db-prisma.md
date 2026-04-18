# 02 - Prisma Database

## Mục tiêu

- Tích hợp Prisma để lưu job, kết quả crawl, và metadata.
- Chuẩn bị cho khả năng truy vấn lịch sử và đồng bộ giữa worker và dashboard.

## Checklist

- [ ] Thiết kế schema Prisma cho jobs và results
- [ ] Kết nối database development
- [ ] Tạo migration đầu tiên
- [ ] Tách layer persistence ra khỏi service crawl
- [ ] Thêm lưu lịch sử job thành công / thất bại

## Ghi chú

- Chỉ làm sau khi dashboard UI ổn định.
- Cần giữ API contract hiện tại để không làm vỡ frontend.
