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

## Monorepo Scaffold

- Created a root Turborepo workspace with npm workspaces.
- Added `apps/web`, `apps/crawler`, `packages/db`, and `packages/shared` scaffolds.
- Added PostgreSQL Docker Compose for local development.
- Introduced Prisma schema groundwork for jobs, posts, profiles, and interactions.
