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

## Monorepo Scaffold

- Created a root Turborepo workspace with npm workspaces.
- Added `apps/web`, `apps/crawler`, `packages/db`, and `packages/shared` scaffolds.
- Added PostgreSQL Docker Compose for local development.
- Introduced Prisma schema groundwork for jobs, posts, profiles, and interactions.
