# 03 - Monorepo Scaffold

## Mục tiêu

- Chuyển repository sang monorepo chuẩn bằng npm workspaces + Turborepo.
- Tách rõ dashboard Next.js, crawler worker, và shared database layer.
- Chuẩn hóa Docker PostgreSQL cho môi trường phát triển local.

## Phạm vi scaffold

- `apps/web`: Next.js dashboard.
- `apps/crawler`: Crawlee + Playwright worker.
- `packages/db`: Prisma schema, client, migrations.
- `packages/shared`: types, constants, validators dùng chung.
- `docker-compose.yml` ở root cho PostgreSQL.
- `package.json` root cho workspaces và scripts điều phối.
- `turbo.json` cho pipeline dev/build/lint.

## Checklist

- [x] Tạo root workspace package.json
- [x] Tạo turbo.json
- [x] Tạo docker-compose PostgreSQL
- [x] Tạo packages/db với Prisma scaffold
- [x] Tạo apps/web từ Next.js hiện có
- [x] Tạo apps/crawler từ worker hiện có
- [x] Tạo packages/shared tối thiểu
- [x] Rà lại scripts và biến môi trường

## Ghi chú kiến trúc

- Dashboard chỉ là control plane.
- Crawler chỉ là execution worker.
- Postgres là source of truth cho job và dữ liệu crawl.

## Trạng thái

- Scaffold file-based đã được tạo trong workspace.
