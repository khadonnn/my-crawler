# 🔥 Production-Ready System: Stale Job Detection + Smart Retry Analysis

## 📌 Problem Statement

**Current State:**

- ❌ Old job `a218291d...` stuck RUNNING 45%, never transitions to FAILED
- ❌ Only manual detection by looking at dashboard ("45% đứng")
- ❌ No automatic cleanup → zombie jobs consume resources
- ❌ Errors are generic strings (can't categorize)
- ❌ No retry capability → must recreate jobs manually

**Production Impact:**

- Queue clogs with dead jobs after hours
- No alerting when jobs hang
- User confusion: is job still running or failed?
- Manual cleanup required daily

---

## 🎯 3-Feature Implementation

### **Feature 1: Auto-Kill Stale Jobs** ⏰

**Duration:** 20 min | **Difficulty:** Medium

#### Problem

Job `a218...` stuck at 45% because:

1. Old worker process (pre-heartbeat-fix code)
2. Job entered uninterruptible state (infinite loop, network hang)
3. No timeout to kill the process
4. No cron to detect and mark as FAILED

#### Solution

**Cron job that runs every 5 minutes:**

- Find all RUNNING jobs
- Check if `updatedAt` is older than 10 minutes
- Mark as FAILED with `blockedReason: "NO_HEARTBEAT"`

#### Implementation

```sql
-- Pseudo-SQL (Prisma will generate this)
UPDATE "Job"
SET status = 'FAILED',
    "blockedReason" = 'NO_HEARTBEAT',
    "finishedAt" = NOW()
WHERE status = 'RUNNING'
  AND "updatedAt" < NOW() - INTERVAL '10 minutes';
```

#### Why This Works

- ✅ Automatic: No human intervention needed
- ✅ Non-destructive: Only marks FAILED, doesn't delete
- ✅ Safe: 10-min threshold avoids killing legitimate slow jobs
- ✅ Retriable: Users can see error reason and retry

#### Implementation Files

- Migration: Add `retryCount` to Job (int, default 0)
- API: `apps/web/app/api/background/stale-jobs/route.ts`
- Cron: Add `node-cron` to web package

---

### **Feature 2: Error Classification** 🔍

**Duration:** 30 min | **Difficulty:** High

#### Problem

Current state:

```ts
// Generic string
blockedReason: "ERROR_MESSAGE_HERE"

// Useless for categorization
if (error.message.includes("captcha")) → "CAPTCHA_WALL"
if (error.message.includes("login")) → "LOGIN_WALL"
// Everything else → null
```

Result: Dashboard shows "FAILED" with no explanation

#### Solution

**Create typed enum for error reasons:**

```ts
enum BlockedReason {
  LOGIN_WALL        // "You must log in" - need better creds
  CAPTCHA           // Captcha challenge - need manual intervention
  TIMEOUT           // Took >60s - network slow, can retry
  NETWORK_ERROR     // ENOTFOUND, ECONNRESET - temporary, can retry
  NO_HEARTBEAT      // Job stale >10min - worker issue
  EXTRACTION_LIMIT  // Hit comment/reaction limit - partial data ok
  UNKNOWN           // Other errors - safety-first no retry
}
```

#### Updated Error Flow

```ts
// Before (generic)
catch (e) {
  blockedReason = detectBlockedReason(e.message) // nullable, string-based
}

// After (typed)
catch (e) {
  if (e instanceof ScraperError) {
    blockedReason = e.code; // TIMEOUT, LOGIN_WALL, etc.
  } else {
    blockedReason = detectBlockedReason(e.message) ?? UNKNOWN;
  }
}
```

#### Where Errors Come From

1. **facebook.scraper.ts** → `withTimeout()` wrapper
   - Throws: `ScraperError("TIMEOUT", "Scrape took 60s")`
2. **isLoginWallOrBlocked()** → URL/DOM scan
   - Throws: `ScraperError("LOGIN_WALL", "Detected Facebook login")`
3. **Network failures** → Playwright
   - Throws: `Error("ENOTFOUND")`
   - Caught as: `BlockedReason.NETWORK_ERROR`

4. **Extraction limits** → Facebook strategy
   - Max comments, reactions hit
   - Throws: `ScraperError("EXTRACTION_LIMIT", "Hit 500 comment limit")`

5. **Stale detection** → Background cron
   - Auto-marks: `BlockedReason.NO_HEARTBEAT`

#### Implementation Files

- Type: `apps/crawler/src/utils/scraper-error.ts` (new)
- Detector: Update `detectBlockedReason()` in scraper.service.ts
- Scraper: Update facebook.scraper.ts throw statements
- Schema: Add `BlockedReasonEnum` to prisma/schema.prisma

---

### **Feature 3: Smart Retry** 🔄

**Duration:** 40 min | **Difficulty:** High

#### Problem

Users want to retry failed jobs, but:

- ❌ Some errors are permanent (bad credentials)
- ❌ Some errors are temporary (network timeout)
- ❌ Blind retry = waste resources on non-fixable errors

#### Solution

**Conditional retry based on error type:**

| Error            | Cause                          | Retriable? | Max Attempts | Why                                     |
| ---------------- | ------------------------------ | ---------- | ------------ | --------------------------------------- |
| LOGIN_WALL       | Credentials expired/IP blocked | ❌ No      | -            | Must update creds/IP manually           |
| CAPTCHA          | Challenge                      | ❌ No      | -            | Needs human verification                |
| TIMEOUT          | Slow network, DOM hang         | ✅ Yes     | 3x           | Likely temporary, longer wait helps     |
| NETWORK_ERROR    | ENOTFOUND, connection reset    | ✅ Yes     | 3x           | Transient, will auto-recover            |
| EXTRACTION_LIMIT | Hit comment limit              | ⚠️ Maybe   | 1x           | Partial data ok, full retry not needed  |
| NO_HEARTBEAT     | Worker crashed                 | ❌ No      | -            | Must restart worker, auto-retry useless |
| UNKNOWN          | Unknown                        | ❌ No      | -            | Safety-first: don't retry unknown       |

#### Retry Backoff Strategy

```ts
// Wait longer between retries (exponential backoff)
const BACKOFF = [
  5_000, // 1st retry: wait 5 seconds
  10_000, // 2nd retry: wait 10 seconds
  20_000, // 3rd retry: wait 20 seconds
];

// In database: store retryCount (0, 1, 2, 3)
// Each time job fails with TIMEOUT, auto-retry after backoff
```

#### User Flow

1. User creates job → scrapes Facebook → hits TIMEOUT
2. Auto-detected: `blockedReason = TIMEOUT`
3. Job auto-marks as FAILED + retryCount = 1
4. System waits 5 seconds
5. System creates new job execution with same URL
6. If still TIMEOUT: retryCount = 2, wait 10s, retry again
7. If still TIMEOUT: retryCount = 3, wait 20s, final retry
8. If still TIMEOUT: give up, mark FAILED permanently

OR (manual retry):

1. User sees job FAILED with reason "TIMEOUT"
2. Retry button appears
3. User clicks → creates new execution with retryCount reset to 1

#### Implementation

```ts
// Database
Job.retryCount: 0 → 1 → 2 → 3

// Endpoint (manual retry)
POST /api/jobs/[jobId]/retry
- Check: status=FAILED && blockedReason in RETRIABLE_REASONS
- Check: retryCount < 3
- Apply backoff: sleep(BACKOFF[retryCount])
- Create new execution

// Auto-retry (optional, in executeCrawl)
catch (error) {
  if (RETRIABLE_REASONS.includes(blockedReason) && retryCount < 3) {
    scheduleRetry(jobId, backoff);
  }
}
```

#### Implementation Files

- Endpoint: `apps/web/app/api/jobs/[jobId]/retry/route.ts` (new)
- Logic: Update scraper.service.ts to track retryCount
- UI: Update datasets/page.tsx to show retry button
- Schema: Add retryCount field to Job

---

## 📊 Database Schema Changes Required

### Current Job Model

```ts
model Job {
  // ... existing fields ...
  blockedReason        String?       // ← Currently String
  // ← retryCount MISSING
}
```

### Updated Job Model

```ts
model Job {
  // ... existing fields ...
  blockedReason        BlockedReason?  // ← Now Enum
  retryCount           Int   @default(0)  // ← NEW
  retryScheduledFor    DateTime?  // ← NEW (when next retry should run)
}

enum BlockedReason {
  LOGIN_WALL
  CAPTCHA
  TIMEOUT
  NETWORK_ERROR
  NO_HEARTBEAT
  EXTRACTION_LIMIT
  UNKNOWN
}
```

### Migration Steps

```bash
# 1. Create new migration
npx prisma migrate dev --name add_retry_and_blocked_reason_enum

# 2. Migration content will:
# - Create BlockedReasonEnum type
# - Add retryCount column (int, default 0)
# - Add retryScheduledFor column (timestamp, nullable)
# - Alter blockedReason to use enum instead of string
```

---

## 🚀 Implementation Timeline

### Phase 1: Schema Extension (10 min)

```
File: packages/db/prisma/schema.prisma
- Add BlockedReasonEnum
- Add retryCount to Job
- Add retryScheduledFor to Job

Run: npx prisma migrate dev
Result: Clean migration, no data loss (default values applied)
```

### Phase 2: Error Classification (30 min)

```
Files:
- apps/crawler/src/utils/scraper-error.ts (CREATE)
- apps/crawler/src/services/scraper.service.ts (UPDATE detectBlockedReason)
- apps/crawler/src/scrapers/facebook/facebook.scraper.ts (UPDATE throws)

Changes:
- Create ScraperError class with typed codes
- Replace generic Error throws with ScraperError
- Update catch block to use typed blockedReason
```

### Phase 3: Stale Job Cron (20 min)

```
Files:
- apps/web/app/api/background/stale-jobs/route.ts (CREATE)
- apps/web/src/lib/background-tasks.ts (CREATE or UPDATE)

Changes:
- Create endpoint that marks stale jobs as FAILED
- Add cron scheduler (node-cron) to run every 5 min
- Log results for monitoring
```

### Phase 4: Retry Endpoint (30 min)

```
Files:
- apps/web/app/api/jobs/[jobId]/retry/route.ts (CREATE)
- apps/web/src/lib/server/job-service.ts (UPDATE)

Changes:
- Check if job FAILED + retriable
- Check retry count < 3
- Apply backoff delay
- Queue new execution
- Return new jobId
```

### Phase 5: UI Updates (40 min)

```
Files:
- apps/web/components/dataset/job-card.tsx (UPDATE)
- apps/web/app/datasets/page.tsx (UPDATE)
- apps/web/components/ui/error-badge.tsx (CREATE)

Changes:
- Show specific blockedReason instead of "FAILED"
- Show retry count (e.g., "Attempt 2/3")
- Add retry button (conditional visibility)
- Color code errors (red/yellow/blue per risk level)
```

**Total: ~2.5 hours**

---

## 🔍 Example: How Feature 3 Fixes Old Job Problem

### Current (No Retry)

```
Job a218: RUNNING 45% → STUCK FOREVER → Eventually manual cleanup
```

### With Stale Detection

```
Job a218: RUNNING 45%
  → Cron runs (5 min interval)
  → Detects: status=RUNNING && updatedAt > 10 min
  → Marks: FAILED + blockedReason="NO_HEARTBEAT"
  → Dashboard shows: "Worker disconnected - restart worker"
  → User knows to check worker health, not "why is it stuck?"
```

### With Smart Retry

```
Job NEW: RUNNING → TIMEOUT error
  → blockedReason = TIMEOUT
  → Auto-mark: FAILED + retryCount = 1
  → Wait 5 sec
  → Create retry execution
  → If still TIMEOUT: retryCount = 2, wait 10s, retry
  → If still TIMEOUT: retryCount = 3, wait 20s, final retry
  → If STILL TIMEOUT: Give up, FAILED permanently

  OR User clicks "Retry" button manually:
  → API validates: status=FAILED && blockedReason=TIMEOUT && retryCount < 3
  → Resets retryCount = 1
  → Queues new execution
  → Job runs again with fresh start
```

---

## ✅ Success Criteria

### Feature 1 (Stale Jobs)

- [ ] Job stuck >10 min auto-marks FAILED
- [ ] Manual cleanup no longer needed
- [ ] Dashboard shows "NO_HEARTBEAT" reason
- [ ] Worker restart clears hung jobs

### Feature 2 (Error Classification)

- [ ] Each failure has specific reason (not UNKNOWN)
- [ ] Dashboard shows different colors per error type
- [ ] Error reason logged in database
- [ ] Users understand what went wrong

### Feature 3 (Smart Retry)

- [ ] TIMEOUT/NETWORK errors auto-retry up to 3x
- [ ] LOGIN_WALL/CAPTCHA show "requires manual fix"
- [ ] Retry button visible only for retriable errors
- [ ] Exponential backoff applied between retries
- [ ] retryCount tracked in database

---

## 🎨 UI/UX Mockup

### Before (Current)

```
Job: FAILED ❌
error: "Scrape timeout"
→ User: "What do I do?"
```

### After (With Feature 2+3)

```
Job: FAILED - TIMEOUT ⏱️ (Yellow badge)
"Scrape took too long - can retry"
[Manual Retry] [View Details]

Attempt: 2/3
Last tried: 2 min ago
```

```
Job: FAILED - LOGIN_WALL 🔐 (Red badge)
"Facebook login wall - session may be expired"
[Update Credentials] [Contact Support]

Attempt: 1/3 (non-retriable)
```

```
Job: FAILED - NO_HEARTBEAT ❌ (Red badge)
"Worker disconnected - restart worker"
[Restart Worker] [View Worker Status]

Attempt: 0 (non-retriable)
```

---

## 🛡️ Edge Cases & Safety

### Case 1: Job completes, then heartbeat updates it to FAILED

```
Job 123: COMPLETED ✅ at T=100s
Cron runs at T=300s: sees COMPLETED (not RUNNING), skips
→ Safe: Only updates RUNNING jobs
```

### Case 2: Legitimate slow job (10+ min)

```
Job 456: RUNNING, still extracting comments at T=600s
Cron: checks if updatedAt > 10 min
  YES: marks FAILED ❌ (incorrectly killed slow job!)

FIX: In scraper, call updateProgress() every 30s
  → updatedAt refreshes continuously
  → Job never gets old enough to trigger stale kill
```

### Case 3: User clicks retry while auto-retry running

```
Job 789: FAILED + auto-retry scheduled for T+5s
User clicks Retry at T+3s
→ API creates new execution immediately
→ Auto-retry at T+5s creates another execution
→ Result: 2 executions for same job

FIX: Check if retry already in-progress before allowing manual retry
```

### Case 4: Retry count increments infinitely

```
Job 999: TIMEOUT → auto-retry → TIMEOUT → auto-retry → ...
After 3 retries: retryCount=3, NOT retry again
→ Safe: Max 3 enforced in code
```

---

## 📈 Monitoring & Alerts

### Metrics to Track

- Jobs marked as NO_HEARTBEAT per day
- Distribution of BlockedReason values
- Retry success rate (how many retries succeeded?)
- Average retries before success

### Alerts

- ⚠️ More than 10% jobs failing with NO_HEARTBEAT → worker issues
- 🔴 More than 50% jobs TIMEOUT → network issues
- 🔵 More than 10 consecutive retries same job → give up

---

## 🎯 Next Steps (For User)

**Ready to implement?**

1. **Approve plan** → any changes to strategy?
2. **Start Phase 1** → Schema migration (safest first)
3. **Proceed Phase 2** → Error types (foundation for rest)
4. **Then Phase 3-5** → Stale detection, retry, UI

**Time estimate:** 2.5 hours for all 5 phases  
**Risk level:** Low (old code not touched, new code isolated)

---
