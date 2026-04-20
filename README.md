# my-crawler

Monorepo cho nền tảng crawling gồm Web UI, Crawler service, và shared packages.

## Project Layout

```text
my-crawler/
├─ ACTIVE_TASK.md
├─ ARCHITECTURE.md
├─ FEATURES_DONE.md
├─ docker-compose.yml
├─ package.json
├─ tsconfig.base.json
├─ turbo.json
├─ apps/
│  ├─ crawler/
│  │  ├─ Dockerfile
│  │  ├─ docker-compose.yml
│  │  ├─ package.json
│  │  ├─ README.md
│  │  ├─ tsconfig.json
│  │  └─ src/
│  │     ├─ main.ts
│  │     ├─ routes.ts
│  │     ├─ controllers/
│  │     │  └─ scraper.controller.ts
│  │     ├─ routes/
│  │     │  └─ scraper.route.ts
│  │     └─ services/
│  │        └─ scraper.service.ts
│  └─ web/
│     ├─ package.json
│     ├─ next.config.ts
│     ├─ tsconfig.json
│     ├─ app/
│     │  ├─ layout.tsx
│     │  ├─ page.tsx
│     │  ├─ api/
│     │  ├─ api-keys/
│     │  ├─ crawlers/
│     │  ├─ datasets/
│     │  ├─ logs/
│     │  ├─ proxies/
│     │  ├─ schedules/
│     │  ├─ settings/
│     │  └─ webhooks/
│     ├─ components/
│     │  ├─ ui/
│     │  ├─ dashboard/
│     │  ├─ crawlers/
│     │  └─ proxies/
│     ├─ hooks/
│     ├─ lib/
│     └─ public/
├─ packages/
│  ├─ db/
│  │  ├─ package.json
│  │  ├─ prisma.config.ts
│  │  ├─ tsconfig.json
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  └─ migrations/
│  │  ├─ generated/
│  │  │  └─ prisma/
│  │  └─ src/
│  │     ├─ index.ts
│  │     └─ prisma.ts
│  └─ shared/
│     ├─ package.json
│     └─ src/
│        └─ index.ts
└─ .docs/
	├─ system-design/
	└─ crawler-plans/
```

## Target Multi-Platform Layout (Planned)

```text
apps/crawler/
├─ storage/                     # Debug artifacts, ignored by git
│  ├─ screenshots/
│  ├─ cookies/
│  └─ raw-extracts/
├─ pocs/                        # Independent proof-of-concept scripts
│  ├─ poc-facebook.ts
│  ├─ poc-google.ts
│  └─ poc-forum.ts
└─ src/
	├─ main.ts
	├─ routes.ts
	├─ controllers/
	├─ routes/
	├─ services/                 # Orchestration only
	│  └─ scraper.service.ts
	├─ scrapers/
	│  ├─ base/
	│  │  ├─ base.scraper.ts
	│  │  └─ scraper.types.ts
	│  ├─ facebook/
	│  │  ├─ facebook.scraper.ts
	│  │  └─ facebook.selectors.ts
	│  ├─ google/
	│  │  └─ google.scraper.ts
	│  └─ factory/
	│     └─ scraper.factory.ts
	├─ observability/
	│  ├─ logger.ts
	│  ├─ ocr.ts
	│  ├─ screenshot.ts
	│  └─ retention.ts
	└─ utils/

packages/shared/src/
├─ index.ts
├─ types/                       # Shared contracts for web + crawler
└─ constants/                   # Shared keywords/platform defaults
```

## Quick Notes

- apps/web: Frontend dashboard (Next.js).
- apps/crawler: Service crawl/scrape data.
- packages/db: Prisma schema, migration, DB access.
- packages/shared: Shared types/utilities, and future cross-app contracts.
- .docs: Tài liệu design và kế hoạch triển khai.

## Setup & Run

### 1. Cài dependencies ở root

Chạy ở thư mục root:

```bash
npm install
```

Vì repo dùng npm workspaces nên lệnh này sẽ cài toàn bộ workspace package bên trong `apps/*` và `packages/*`, gồm cả `apps/web`, `apps/crawler`, `packages/db`, và `packages/shared`.

### 2. Chạy Docker ở root

File `docker-compose.yml` ở root hiện chỉ có PostgreSQL. Chạy:

```bash
docker compose up -d
```

Nếu cần xem log:

```bash
docker compose logs -f postgres
```

### 3. Chạy app ở root

Sau khi `npm install`, chạy:

```bash
npm run dev
```

Lệnh này gọi `turbo run dev` và sẽ chạy các workspace có script `dev`. Hiện tại cả `apps/web` và `apps/crawler` đều có `dev`, nên root dev sẽ start cả hai.

### 4. Chạy riêng từng app khi cần

```bash
npm --workspace @scraping-platform/web run dev
npm --workspace @scraping-platform/crawler run dev
```

## Architecture Direction

- Current state is a single crawler execution flow in scraper.service.ts.
- Next step is Strategy Pattern by platform (facebook/google/others) routed by factory.
- Keep POCs outside src to avoid production build coupling.
- Keep observability first: terminal logs, screenshots, and raw extract samples.
