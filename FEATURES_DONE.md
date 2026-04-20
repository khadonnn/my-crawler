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

## Crawler Observability + Strategy Refactor

- Split the crawler execution flow into platform strategies with a factory router.
- Added shared scraper contracts in `packages/shared` for request/result typing.
- Added crawler observability helpers for structured logs, debug screenshots, raw extracts, and retention cleanup.
- Added a Facebook PoC entrypoint under `apps/crawler/pocs/` and a `poc:facebook` script.
- Verified the crawler package builds successfully after the refactor and observability wiring.
- Wired `debugMode` end-to-end from web crawler form -> jobs API -> worker `/api/scrape` -> scraper execution, with optional rerun override payload.

## OCR Observability Upgrade

- Installed `tesseract.js` in crawler package for Node.js-only OCR.
- Added `extractTextFromImage(imagePath, lang)` in observability OCR module.
- Integrated Facebook PoC flow to OCR the `after-scroll` screenshot and print extracted text in terminal.
- Added OCR artifact writer to persist `{ imagePath, extractedText, createdAt }` into `storage/<jobId>/raw-extracts/<jobId>-ocr-result.json`.
- Hardened artifact writers to always create directories with `fs.mkdirSync(dirPath, { recursive: true })` before saving files.
- Bootstrapped repository-kept storage structure with `.gitkeep` files for:
  - `apps/crawler/storage/`
  - `apps/crawler/storage/screenshots/`
  - `apps/crawler/storage/cookies/`
  - `apps/crawler/storage/raw-extracts/`
- Updated crawler `.gitignore` to ignore runtime artifacts under `storage/` while keeping `.gitkeep` files tracked.

## Cookie Injection Foundation (DB + Session + API)

- Added Prisma `Account` model for platform account/session storage (`sessionData` JSON + status lifecycle fields).
- Ran Prisma sync and client generation after schema update.
- Made Prisma env loading workspace-aware so `DATABASE_URL` resolves from root `.env`, `packages/db/.env`, or app-local `.env` when Next.js runs from a subdirectory.
- Added Playwright session generator script at `apps/crawler/src/pocs/gen-session.ts` with interactive Enter-to-save flow.
- Session generator now stores cookie/session state at `apps/crawler/storage/cookies/facebook-session.json` and auto-creates folder recursively.
- Added crawler npm script: `gen-session`.
- Added web API endpoint `POST /api/accounts` to persist account session payload with JSON parse validation.
- API rejects invalid JSON with HTTP 400 and does not log cookie/session payloads.

## Cookie Injection UI + Account Dashboard + Session-Aware Crawler

- Added cookie import modal component at `apps/web/components/crawlers/cookie-import-modal.tsx` with:
  - Name input
  - Session JSON textarea
  - Submit flow to `POST /api/accounts`
  - Loading state and invalid JSON error handling.
- Added account management dashboard page at `/accounts` with table columns:
  - Name
  - Status
  - Actions
- Added account actions in UI: Activate, Disable, Delete.
- Extended account APIs:
  - `GET /api/accounts` for listing accounts
  - `PATCH /api/accounts/[id]` for status updates (`ACTIVE`/`DISABLED`)
  - `DELETE /api/accounts/[id]` for account removal
- Added sidebar navigation entry for `/accounts`.
- Updated Facebook scraper to fetch an active Facebook account session before crawl.
- Scraper now injects session cookies/localStorage from `account.sessionData` before page navigation when available.
- Scraper logs warning and falls back to anonymous mode when no active account/session is available.
- Scraper updates `lastUsedAt` after successful crawl when account session is used.

## Login Wall Detection + Reactions Trigger + End-to-End Reactions UI

- Added login wall detection in Facebook scraper: when crawled URL contains `login`, linked account is marked `EXPIRED`.
- Added `POST /api/crawl/reactions` API to trigger reactions crawl by `postId`, returning a `jobId` for tracking.
- Added post data endpoints to support dashboard reaction workflows:
  - `GET /api/posts?jobId=...` for listing posts in a job context.
  - `GET /posts/:id/reactions` for fetching reactions of a post.
  - (Compatibility route retained) `GET /api/posts/:id/reactions`.
- Upgraded `/datasets` page to support end-to-end reaction flow:
  - User clicks `View Reactions` on a post.
  - Frontend calls `GET /posts/:id/reactions`.
  - If empty, frontend auto-calls `POST /api/crawl/reactions`, shows loading, waits for job completion, then fetches reactions again.

## Dashboard Onboarding Checklist

- Added a server-rendered onboarding checklist on the dashboard to guide new users through the scraping flow.
- Checklist uses real Prisma counts for active accounts, total jobs, completed jobs, and interactions.
- Added per-step badges, action links, and an overall progress bar.
- Increased the dashboard growth chart minimum height so the layout stays readable with sparse data.
