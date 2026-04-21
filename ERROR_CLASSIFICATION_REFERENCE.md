# Error Classification Reference Table

| Error Code           | Cause                               | Example                                 | Retriable?   | Max Attempts | Recommended Action                         | UI Badge Color |
| -------------------- | ----------------------------------- | --------------------------------------- | ------------ | ------------ | ------------------------------------------ | -------------- |
| **LOGIN_WALL**       | Facebook detected login requirement | "Your account was logged out"           | ❌ **NO**    | -            | Update session/cookies or account password | 🔴 RED         |
| **CAPTCHA**          | Captcha challenge required          | "Please solve this captcha"             | ❌ **NO**    | -            | Manual verification needed                 | 🔴 RED         |
| **TIMEOUT**          | Scrape took >60 seconds             | "Scrape timeout after 60s"              | ✅ **YES**   | 3            | Will auto-retry with longer wait           | 🟡 YELLOW      |
| **NETWORK_ERROR**    | Network connectivity issue          | "ENOTFOUND: facebook.com"               | ✅ **YES**   | 3            | Temporary network issue, will recover      | 🟡 YELLOW      |
| **EXTRACTION_LIMIT** | Hit comment/reaction limit          | "Extracted 500 comments, limit reached" | ⚠️ **MAYBE** | 1            | Partial data saved, full retry not needed  | 🔵 BLUE        |
| **NO_HEARTBEAT**     | Worker disappeared                  | "Job stale >10 minutes, worker offline" | ❌ **NO**    | -            | Restart worker service                     | 🔴 RED         |
| **UNKNOWN**          | Unknown error                       | "Internal server error"                 | ❌ **NO**    | -            | Contact support or check logs              | ⚫ GRAY        |

## Auto-Retry Backoff Timeline

When a job fails with **TIMEOUT** or **NETWORK_ERROR**:

```
Attempt 1 (fails)
    ↓
    Wait 5 seconds
    ↓
Attempt 2 (fails)
    ↓
    Wait 10 seconds
    ↓
Attempt 3 (fails)
    ↓
    Wait 20 seconds
    ↓
Attempt 4 (fails)
    ↓
    ❌ GIVE UP - Mark FAILED permanently
```

## Dashboard Visual Indicators

```
🔴 RED (Non-Retriable)
├── LOGIN_WALL: "❌ Facebook login wall detected - Session expired?"
├── CAPTCHA: "❌ Captcha challenge detected - Manual verification needed"
├── NO_HEARTBEAT: "❌ Worker disconnected - Service restarted?"
└── UNKNOWN: "❌ Unknown error - Check logs"

🟡 YELLOW (Auto-Retrying)
├── TIMEOUT: "⏱️ Timeout (Attempt 1/3) - Auto-retrying in 5s..."
└── NETWORK_ERROR: "🌐 Network error (Attempt 2/3) - Auto-retrying in 10s..."

🔵 BLUE (Partial Success)
└── EXTRACTION_LIMIT: "📊 Extraction limit reached - Partial data (500/600 items)"

✅ GREEN (Success)
└── COMPLETED: "✓ Successfully extracted 1,500 leads"
```

## Implementation Priority

1. **Phase 1** (MUST HAVE): Schema extension + retryCount field
2. **Phase 2** (MUST HAVE): Error classification enum + typed exceptions
3. **Phase 3** (MUST HAVE): Stale job detection cron (solves zombie jobs)
4. **Phase 4** (SHOULD HAVE): Smart retry endpoint + logic
5. **Phase 5** (NICE TO HAVE): UI improvements + retry button

## File Changes Summary

### Files to Create

- `apps/crawler/src/utils/scraper-error.ts` - Typed error class
- `apps/web/app/api/background/stale-jobs/route.ts` - Stale job detection endpoint
- `apps/web/app/api/jobs/[jobId]/retry/route.ts` - Retry endpoint
- `apps/web/src/lib/background-tasks.ts` - Cron scheduler

### Files to Update

- `packages/db/prisma/schema.prisma` - Add BlockedReasonEnum, retryCount
- `apps/crawler/src/services/scraper.service.ts` - Update error detection
- `apps/crawler/src/scrapers/facebook/facebook.scraper.ts` - Throw typed errors
- `apps/web/app/datasets/page.tsx` - Show error badges, retry button
- `apps/web/components/dashboard/job-card.tsx` - Display retry count

### Database Migrations

- Create: `add_retry_count_and_blocked_reason_enum`
- Adds: retryCount (int default 0), retryScheduledFor (datetime nullable)
- Modifies: blockedReason from String to BlockedReasonEnum

## Code Examples

### Creating Typed Error

```ts
// OLD: Generic error
throw new Error("Page took too long to load, timeout!");

// NEW: Typed error
throw new ScraperError("TIMEOUT", "Page took too long to load, timeout!");
```

### Detecting Error in Catch Block

```ts
catch (error: any) {
  let blockedReason = "UNKNOWN";

  if (error instanceof ScraperError) {
    blockedReason = error.code; // Use specific code
  } else {
    blockedReason = detectBlockedReason(error.message) ?? "UNKNOWN";
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      blockedReason, // Now typed enum
      errorMessage: error.message,
      finishedAt: new Date(),
    },
  });
}
```

### Stale Job Cron Query

```ts
// Every 5 minutes, find jobs stuck for >10 minutes
const STALE_TIMEOUT = 10 * 60 * 1000; // 10 minutes

const updated = await prisma.job.updateMany({
  where: {
    status: "RUNNING",
    updatedAt: {
      lt: new Date(Date.now() - STALE_TIMEOUT),
    },
  },
  data: {
    status: "FAILED",
    blockedReason: "NO_HEARTBEAT",
    finishedAt: new Date(),
  },
});

console.log(`Marked ${updated.count} stale jobs as FAILED`);
```

### Retry Endpoint

```ts
export async function POST(req: Request, { params }) {
  const job = await prisma.job.findUnique({
    where: { id: params.jobId },
  });

  // Check if retriable
  const RETRIABLE = ["TIMEOUT", "NETWORK_ERROR", "EXTRACTION_LIMIT"];
  if (
    !job ||
    job.status !== "FAILED" ||
    !RETRIABLE.includes(job.blockedReason)
  ) {
    return Response.json({ error: "Not retriable" }, { status: 400 });
  }

  // Check retry limit
  if (job.retryCount >= 3) {
    return Response.json({ error: "Max retries exceeded" }, { status: 400 });
  }

  // Apply backoff
  const BACKOFF_MS = [5000, 10000, 20000];
  const delay = BACKOFF_MS[job.retryCount];
  await new Promise((r) => setTimeout(r, delay));

  // Create new execution
  const newJobId = await scraperService.addScrapeJob(job.url, {
    clientJobId: job.id, // Link to original
    retryAttempt: job.retryCount + 1,
  });

  return Response.json({ newJobId, retryCount: job.retryCount + 1 });
}
```
