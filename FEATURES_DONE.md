# FEATURES DONE

## Proxy Selection In Create Job + GeoIP Runtime Fix

- Fixed GeoIP runtime dependency placement for web API routes:
  - Installed `geoip-lite` in `apps/web` so `/api/proxies` and `/api/proxies/bulk-import` can actually detect region at runtime.
  - Installed `@types/geoip-lite` in `apps/web` for TS typing.
- Added ability to select a specific imported proxy directly in create-job form:
  - `apps/web/components/crawlers/new-crawler-form.tsx` now has `Proxy Cu The (optional)` dropdown populated from WORKING proxies.
  - If selected, form sends `selectedProxyId` in create job payload.
- Wired `selectedProxyId` end-to-end:
  - Web API: `apps/web/app/api/jobs/route.ts`, `apps/web/app/api/jobs/create/route.ts`.
  - Orchestration layer: `apps/web/lib/server/jobs.ts`.
  - Worker API/controller: `apps/crawler/src/controllers/scraper.controller.ts`.
  - Worker runtime selection: `apps/crawler/src/services/scraper.service.ts`.
- Worker behavior update:
  - Prefer selected proxy by id when provided.
  - Fallback to region-based proxy selection when selected id is missing/invalid.
- Validation completed:
  - `npm --workspace @scraping-platform/web run build`
  - `npm --workspace @scraping-platform/crawler run build`
  - Both builds passed.

## Proxy GeoIP Region Auto-Detect + Dynamic Region Selector

- Added automatic region detection for proxy import/create when `region` is omitted:
  - `apps/web/app/api/proxies/route.ts`
  - `apps/web/app/api/proxies/bulk-import/route.ts`
- Region detection logic:
  - Uses `geoip-lite` lookup for IP addresses.
  - Maps `country=VN -> VN`, `country=US -> US`, otherwise `ANY`.
  - Keeps explicit user-provided region unchanged.
  - Falls back to `ANY` gracefully if GeoIP database is unavailable.
- Updated crawler create-job form to derive Proxy Region options from imported proxy data (instead of static-only list):
  - `apps/web/components/crawlers/new-crawler-form.tsx`
  - Always includes `ANY`, plus detected/imported regions.
  - Keeps current selected region valid when proxy inventory changes.
- Updated proxy import dialog helper text to mention auto-detect behavior when region is not provided:
  - `apps/web/components/proxies/import-proxy-dialog.tsx`
- Validation completed:
  - `npx turbo build --filter=@scraping-platform/web` passed.

## Final Optimization Package (UI + Incremental Persist + Progress Phases)

- Refactored crawler strategy contract to support partial result emission via `ScrapeOptions.onPartialResult` while keeping `execute()` return contract backward compatible.
- Updated Facebook search strategy to emit per-URL partial results and summary output without in-strategy persistence or full in-memory merge.
- Implemented service-level incremental persistence for search mode:
  - Persist per URL immediately when partial result arrives.
  - Structured logs for partial persist start/success/failure.
  - Resilient behavior so persisted chunks survive mid-run failures.
- Implemented phased progress semantics for search mode:
  - Search phase: `0 -> 20`
  - URL crawl phase: `20 -> 80`
  - Finalize phase: `80 -> 100`
- Added robust checkpointing for search resume via `Job.searchProgressIndex`:
  - Persist checkpoint (`index + 1`) after each successful partial persist.
  - Resume SEARCH_KEYWORD crawl from checkpoint index after retry/restart.
  - Avoid re-crawling already persisted URLs.
- Polished create-job UI with conditional rendering by mode (unmounting inactive field):
  - DIRECT mode renders URL input only.
  - SEARCH mode renders Keyword input only.
  - Submit payload contains only mode-appropriate field and strategy mapping.
- Validation completed:
  - `npm --workspace @scraping-platform/web run build`
  - `npm --workspace @scraping-platform/crawler run build`
  - Both builds passed.

## Crawlers Console Mode UX (Package 3)

- Updated create-job form UI to support explicit mode switch:
  - DIRECT_URL (URL Truc tiep)
  - SEARCH_KEYWORD (Tim theo tu khoa)
- Added dynamic input behavior in `apps/web/components/crawlers/new-crawler-form.tsx`:
  - DIRECT mode enables URL input and disables Keyword input.
  - SEARCH mode enables Keyword input and disables URL input.
- Updated submit payload to include strategy with matching mode:
  - `FACEBOOK_DIRECT` -> `DIRECT_URL`
  - `FACEBOOK_SEARCH` -> `SEARCH_KEYWORD`
- Updated jobs API parser in `apps/web/app/api/jobs/route.ts` to accept `strategy` and map to `platform/mode` safely.
- Verified web build success after changes.

## Deep Scrape Safety Discipline (Package 2)

- Enforced hard deep-scrape limits in `apps/crawler/src/scrapers/facebook/facebook.scraper.ts`:
  - `MAX_SCROLL = 3`
  - `MAX_COMMENTS = 15`
  - `MAX_POST_TIME_MS = 30000` (30s per post)
- Added comment-loop guard to stop collecting once comment limit is reached.
- Wrapped per-post deep scrape execution with `Promise.race()` time-limit handling.
- Timeout now returns partial entities safely (skip/fallback behavior) instead of killing the whole job pipeline.
- Preserved already collected profiles/comments/reactions when stopping early due to limit or timeout.

## Facebook Keyword Search - Inline Sequential Crawl

- Implemented URL-based Facebook posts search in `apps/crawler/src/scrapers/facebook/facebook-search.scraper.ts`.
- Collected and normalized up to 5 search result post URLs after a bounded scroll pass.
- Reused the existing Facebook direct crawler sequentially for each result URL inside the same SEARCH_KEYWORD job.
- Kept the job output and DB persistence in a single pipeline by merging extracted posts, profiles, and interactions before the existing service persistence step.
- Added `fbPostId` linkage to interaction payloads so merged multi-post jobs persist comment/reaction rows against the correct post.

## Production Hardening Finalization (Durable Retry + Manual Retry + Timeline)

- Reworked retry execution in worker runtime (`apps/crawler/src/services/scraper.service.ts`):
  - Removed volatile in-memory delayed retry trigger.
  - Added periodic durable retry queue processor that picks due jobs from DB (`status=PENDING`, `retryScheduledFor<=now`) and lock-guards dispatch.
  - Added hard-timeout sweep in worker loop based on `lastHeartbeatAt` (authoritative heartbeat signal) to fail stale `RUNNING` jobs.
- Added manual retry endpoint `POST /api/jobs/[jobId]/retry`:
  - Only allows retries for `FAILED` jobs.
  - Rejects when retry budget is exhausted (`retryCount >= maxRetry`).
  - Resets runtime state to queued (`status=PENDING`, `retryScheduledFor=now`) without resetting retry history counters.
- Extended jobs payload server mapping (`apps/web/lib/server/jobs.ts`) with fields needed for ops diagnostics and timeline:
  - `errorDetail`, `retryScheduledFor`, `lockedAt`, `startedAt`, `finishedAt`, `lastHeartbeatAt`.
- Updated Crawlers console (`apps/web/components/crawlers/crawlers-console.tsx`):
  - Added `Retry` button for failed jobs, disabled when retry budget exhausted.
  - Kept `Rerun` behavior as separate new-job flow.
- Updated Datasets page (`apps/web/app/datasets/page.tsx`) with job timeline panel:
  - Shows key lifecycle timestamps and retry scheduling signal for debugging stuck/slow jobs.
- Validation completed:
  - `npm --workspace @scraping-platform/crawler run build`
  - `npm --workspace @scraping-platform/web run build`
  - Both builds passed.

## Smart Retry + Dashboard Error Visibility - Package 3

- Implemented worker-side smart retry with exponential backoff in `scraper.service.ts`:
  - `LOGIN_WALL` and `CAPTCHA`: never auto-retry, mark `FAILED` directly.
  - `TIMEOUT` and `NETWORK_ERROR`: auto-retry only when `retryCount < maxRetry`.
  - Backoff formula: `delayMs = (2 ** retryCount) * 5000`.
  - On scheduled retry: set job back to `PENDING`, increment `retryCount`, set `retryScheduledFor`, and clear `lockedBy`/`lockedAt`.
- Extended jobs list payload for UI diagnostics:
  - Added `retryCount`, `maxRetry`, and `lockedBy` in server job list mapping.
- Upgraded Crawlers console UI:
  - Added failure reason badge for `FAILED` jobs using `blockedReason`.
  - Added retry progress display (`retryCount/maxRetry`).
  - Added current lock owner display (`lockedBy`).
- Upgraded datasets job detail panel (`View Data` flow):
  - Shows retry ratio (`retryCount/maxRetry`).
  - Shows current worker lock id (`lockedBy`).
  - Shows failure reason when status is `FAILED`.
- Validation completed:
  - `npm --workspace @scraping-platform/crawler run build`
  - `npm --workspace @scraping-platform/web run build`
  - Both builds passed.

## Production Core Runtime - Package 2 (Locking + Heartbeat + Sweep)

- Implemented worker-side job locking guard in `scraper.service.ts`:
  - Job must be `PENDING` and `lockedBy = null` before execution starts.
  - Lock acquisition is done with conditional `updateMany` and worker lock metadata (`lockedBy`, `lockedAt`).
  - Worker only transitions job to `RUNNING` if lock owner matches the current worker job id.
- Confirmed heartbeat update path writes `lastHeartbeatAt` whenever progress is updated.
- Added stale job cleanup endpoint `POST /api/jobs/sweep`:
  - Finds `RUNNING` jobs with stale heartbeat older than 10 minutes.
  - Uses `lastHeartbeatAt` first, and `lockedAt` fallback if heartbeat has not been written yet.
  - Marks stale jobs as `FAILED` with `blockedReason = NO_HEARTBEAT`.
  - Clears lock metadata and stamps finished time.
- Validation completed:
  - `npm --workspace @scraping-platform/crawler run build`
  - `npm --workspace @scraping-platform/web run build`
  - Both builds passed.

## Production Foundation - Package 1 (DB + Error Classification)

- Upgraded Prisma `Job` schema with production anti-stuck and retry-control fields:
  - `blockedReason` converted to enum `BlockedReason`.
  - Added `errorDetail`, `lastHeartbeatAt`, `retryCount`, `maxRetry`, `retryScheduledFor`, `lockedBy`, and `lockedAt`.
- Added Prisma enum `BlockedReason` with values:
  - `LOGIN_WALL`, `CAPTCHA`, `TIMEOUT`, `NETWORK_ERROR`, `NO_HEARTBEAT`, `EXTRACTION_LIMIT`, `UNKNOWN`.
- Added migration `20260421002350_add_job_locking_heartbeat_error_classification` and regenerated Prisma Client.
- Introduced typed crawler error model at `apps/crawler/src/errors/scraper.error.ts`:
  - `ScraperError` class with strongly-typed `reason`.
  - Runtime guard `isBlockedReason`.
- Integrated typed error classification into crawler execution flow:
  - `facebook.scraper.ts`: throws `ScraperError` for login/captcha/timeout conditions.
  - `facebook-search.scraper.ts`: throws `ScraperError` for login wall and selector timeout.
  - `scraper.service.ts`: maps error -> blocked reason, persists `errorDetail` stack, updates lock and heartbeat metadata.
- Validation completed:
  - `npm --workspace @scraping-platform/db run db:migrate -- --name add_job_locking_heartbeat_error_classification`
  - `npm --workspace @scraping-platform/db run db:generate`
  - `npm --workspace @scraping-platform/crawler run build`
  - `npm --workspace @scraping-platform/web run build`
  - All commands passed.

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

## Proxy Region End-to-End (Selection + Visibility)

- Added `ProxyRegion` enum to Prisma schema and introduced region tagging for `Proxy` records.
- Added job-level proxy metadata fields to persist region request and actual proxy used:
  - `requestedProxyRegion`
  - `usedProxyId`
  - `usedProxyAddress`
  - `usedProxyPort`
  - `usedProxyRegion`
- Added migration: `packages/db/prisma/migrations/20260420113000_add_proxy_region_and_job_proxy_meta/migration.sql`.
- Updated proxies APIs to accept/normalize region on create and bulk import.
- Extended bulk import parser to support lines like:
  - `ip:port`
  - `ip:port:user:pass`
  - `ip:port:region`
  - `ip:port:user:pass:region`
- Updated `/proxies` UI table to display a dedicated Region column.
- Updated crawler form helper text to clarify region behavior.
- Implemented worker-side proxy selection by requested region, prioritizing `WORKING` proxies and falling back safely.
- Wired selected proxy into Crawlee Playwright configuration (`proxyUrls`) for both generic and Facebook scrapers.
- Updated jobs list output and crawler console UI to show requested region and actual proxy used per job.
- Regenerated Prisma Client successfully after schema update.

## Dashboard Onboarding Checklist

- Added a server-rendered onboarding checklist on the dashboard to guide new users through the scraping flow.
- Checklist uses real Prisma counts for active accounts, total jobs, completed jobs, and interactions.
- Added per-step badges, action links, and an overall progress bar.
- Increased the dashboard growth chart minimum height so the layout stays readable with sparse data.

## Multi-Platform Strategy + Factory Foundation (Backward Compatible)

- Extended Prisma `Job` model with routing fields for future multi-platform crawling:
  - `platform` enum (`FACEBOOK`, `GOOGLE`, `YOUTUBE`, `TIKTOK`) with default `FACEBOOK`.
  - `mode` enum (`DIRECT_URL`, `SEARCH_KEYWORD`) with default `DIRECT_URL`.
  - Optional `url` field to support search-first jobs while preserving existing URL-first flow.
- Updated jobs API validation to use cross-validation by crawl mode:
  - `DIRECT_URL` requires valid `url`.
  - `SEARCH_KEYWORD` requires non-empty `keyword`.
- Kept current UI flow fully compatible by defaulting to `FACEBOOK + DIRECT_URL` when platform/mode is not provided.
- Updated worker `/api/scrape` contract and service pipeline to accept/pass-through `platform`, `mode`, and `keyword`.
- Refactored scraper routing to Strategy + Factory style:
  - Added `createScraperStrategy({ platform, mode, url })` for explicit routing.
  - Added `FacebookDirectStrategy` preserving existing direct URL behavior.
  - Added initial `FacebookSearchStrategy` skeleton to execute keyword search navigation flow.
  - Preserved URL-host fallback routing for backward compatibility.
- Regenerated Prisma Client and verified both package builds after changes:
  - `@scraping-platform/crawler` build passes.
  - `@scraping-platform/web` build passes.

## Job Progress Tracking & Real-Time Visibility

- Implemented GET endpoint `/api/jobs/[jobId]` to fetch individual job details via new route handler.
- Added progress heartbeat mechanism in crawler worker (`scraper.service.ts`):
  - Automatic progress updates every 15 seconds (non-blocking async).
  - Stage-based milestones: 5% (start) → 70% (scrape complete) → 80% (dataset push) → 90% (artifacts) → 100% (finished).
  - Wrapped in try/catch to prevent blocking job execution on progress DB write failures.
  - Heartbeat capped at 45% during initial processing phase to avoid falsely showing completion.
- Enhanced datasets page UI (`apps/web/app/datasets/page.tsx`) with real-time progress tracking:
  - Visual progress bar (0-100%) with percentage display.
  - Estimated remaining time (ETA) calculated dynamically from elapsed time ÷ current progress %.
  - Last update timestamp showing time since last progress change.
  - Stuck job detection: flags RUNNING jobs with no updates > 5 minutes as potentially stuck.
  - Visual heartbeat animation: displays 10-25% animated range when actual progress is 0 to indicate job is alive/executing.
  - Auto-refresh every 1 second via `setInterval` to update ETA countdown in real-time as job progresses.
  - Delete action for stuck jobs with confirmation dialog.
- Verified end-to-end heartbeat correctness:
  - Progress increments by 5% every 15 seconds: 5% → 15% → 20% → 25% → 30% → 35% → 40% → 45%.
  - Database `updatedAt` timestamp updates on each heartbeat tick.
  - No blocking delays to crawler execution due to non-awaited progress updates.
  - Old jobs (pre-heartbeat code) remain at 0% with stale `updatedAt` until marked as stuck and deleted.

## Progress Heartbeat Freshness Fix

- Fixed stale RUNNING jobs at 45% by continuing heartbeat writes after reaching the 45% cap.
- Worker now keeps updating `updatedAt` every 15 seconds while the long scrape stage is still running.
- This prevents false "stuck" detection caused only by heartbeat silence at capped progress.

## Proxy Onboarding Step

- Added a 5-step getting-started flow that now begins on `/` and points users to `/proxies` as the second step.
- Added an onboarding CTA on the home page so users can move straight from the dashboard to proxy setup.
- Added a next-step CTA on `/proxies` so the onboarding flow continues into account setup instead of stopping at proxy management.
