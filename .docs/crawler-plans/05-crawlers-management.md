# 05 - Crawlers Management Console

## Muc tieu

- Xay dung trang `/crawlers` de quan ly toan bo crawler jobs theo huong van hanh chuyen sau.
- Tach ro vai tro "Quick Launch" (tao job nhanh) va "My Crawlers" (quan tri lich su + dieu phoi jobs).
- Lien ket truc tiep web app voi crawler worker thong qua API route cua `apps/web`.

## Pham vi

### 1) Jobs API

- Them `GET /api/jobs` de lay lich su jobs.
- Them `POST /api/jobs` de tao crawler job voi cau hinh nang cao.
- Them `POST /api/jobs/[jobId]/rerun` de chay lai job cu.
- Them `POST /api/jobs/[jobId]/stop` de dung job dang cho/chay.
- Refactor `POST /api/jobs/create` de dung chung helper tao job.

### 2) Crawlers UI

- Trang `/crawlers` hien thi:
  - Header va mo ta vai tro van hanh phan tan.
  - Nút `New Crawler` mo form `Advanced Create`.
  - Bang lich su jobs (ID, URL, Ngay chay, Leads, Status, Actions).
- Hanh dong tai moi dong:
  - `Rerun`
  - `Stop`
  - `View Data` (dieu huong sang `/datasets?jobId=...`).

### 3) Advanced Create Form

- Truong bat buoc: URL.
- Truong bo sung: Keywords, Crawl Scope, Proxy Region, Schedule.
- Gui payload len `/api/jobs` va hien thi ket qua tao job.

## Rang buoc

- Khong doi schema Prisma trong buoc nay.
- Khong pha vo contract cu cua `Quick Launch`.
- Uu tien tai su dung primitives trong `components/ui`.

## Checklist

- [x] Them server helper cho orchestration jobs (`apps/web/lib/server/jobs.ts`)
- [x] Them jobs API routes (`/api/jobs`, `/api/jobs/[jobId]/rerun`, `/api/jobs/[jobId]/stop`)
- [x] Refactor `/api/jobs/create` de dung chung luong tao job
- [x] Them form tao job nang cao (`new-crawler-form.tsx`)
- [x] Refactor trang `/crawlers` thanh console quan ly jobs
- [x] Them lien ket `View Data` sang `/datasets?jobId=...`
- [x] Kiem tra TypeScript errors cho `apps/web`
