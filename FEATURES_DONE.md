# FEATURES DONE

## Scraper Worker

- Refactored the monolithic Express scraper into Router - Controller - Service layers.
- Preserved the existing API contract for `/api/scrape`, `/api/status/:jobId`, and `/api/health`.
- Fixed TypeScript NodeNext import resolution by using `.js` extensions in source imports.
- Kept Crawlee job isolation with per-job datasets and cleanup behavior.

## Frontend Dashboard Stability Fixes

- Fixed sidebar hydration mismatch by making `AppSidebar` a client component and normalizing sidebar navigation links to stable anchor rendering.
- Replaced the default starter home content to remove the `vercel.svg` image ratio warning.
- Added missing Next.js routes for sidebar navigation paths: `/crawlers`, `/crawlers/new`, `/datasets`, `/schedules`, `/settings`, `/logs`, `/proxies`, `/api-keys`, and `/webhooks`.

## Proxy Bulk Import (Paste-and-Import)

- Completed end-to-end bulk import flow from proxy paste input to database insert.
- Updated API route `/api/proxies/bulk-import` to parse `ip:port:user:pass`, support semicolon/newline separated input, and insert in bulk with Prisma `createMany({ skipDuplicates: true })`.
- Added robust failure accounting for invalid rows and duplicate rows skipped by the database.
- Updated import dialog preprocessing so pasted lists with `;` delimiters are accepted without manual cleanup.

## Proxy Import UX + Reliability Fix

- Replaced alert-based feedback with toast notifications using `sonner`.
- Fixed import dialog behavior: only treats HTTP success as success and closes modal after successful import response.
- Added fallback insert path when Prisma `createMany` fails unexpectedly, reducing 500 errors during bulk import.
- Added explicit error state + retry action in proxy table when `/api/proxies` returns 500.

## Dashboard Command Center (Bento + Charts)

- Replaced the home page with a Bento-style command center layout on `/`.
- Added dashboard API routes in the web app:
  - `/api/dashboard` for KPI, growth, quality, and running tasks data.
  - `/api/worker-health` for worker online/offline status checks.
  - `/api/proxy-health` for proxy live-rate statistics.
- Added reusable dashboard UI components under `apps/web/components/dashboard/`:
  - `kpi-cards.tsx`
  - `growth-chart.tsx`
  - `quality-pie.tsx`
  - `running-tasks.tsx`
  - `quick-launch.tsx`
  - `dashboard-shell.tsx`
- Added missing UI primitives used by the dashboard:
  - `components/ui/card.tsx`
  - `components/ui/progress.tsx`
  - `components/ui/chart.tsx`
- Integrated polling every 10s via SWR for near real-time dashboard updates.
- Installed and wired `recharts` for line and pie charts.
- Implemented quick launch action to send instant scrape requests to Worker API.
- Extended Prisma schema with `Proxy` model and regenerated Prisma Client.

## Crawlers Management Console

- Replaced placeholder `/crawlers` page with a full management console for distributed job operations.
- Added advanced crawler creation form with detailed options:
  - URL
  - Keywords
  - Crawl scope (Profile only / Post only / Profile + Post)
  - Proxy region (ANY / VN / US)
  - Schedule expression
- Added jobs control APIs in web app:
  - `GET /api/jobs`
  - `POST /api/jobs`
  - `POST /api/jobs/[jobId]/rerun`
  - `POST /api/jobs/[jobId]/stop`
- Refactored existing quick-launch backend route `/api/jobs/create` to share the same orchestration helper with advanced create.
- Added "View Data" navigation from job rows to `/datasets?jobId=<id>` and updated dataset page to surface selected job context.

## Monorepo Scaffold

- Created a root Turborepo workspace with npm workspaces.
- Added `apps/web`, `apps/crawler`, `packages/db`, and `packages/shared` scaffolds.
- Added PostgreSQL Docker Compose for local development.
- Introduced Prisma schema groundwork for jobs, posts, profiles, and interactions.
