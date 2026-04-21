import { getPrisma } from "@scraping-platform/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const STALE_TIMEOUT_MS = 10 * 60 * 1000;

export async function POST() {
  try {
    const prisma = getPrisma();
    const now = new Date();
    const staleCutoff = new Date(now.getTime() - STALE_TIMEOUT_MS);

    const result = await prisma.job.updateMany({
      where: {
        status: "RUNNING",
        OR: [
          {
            lastHeartbeatAt: {
              lt: staleCutoff,
            },
          },
          {
            lastHeartbeatAt: null,
            lockedAt: {
              lt: staleCutoff,
            },
          },
        ],
      },
      data: {
        status: "FAILED",
        blockedReason: "NO_HEARTBEAT",
        errorMessage: "STALE_JOB_TIMEOUT",
        errorDetail:
          "Marked failed by sweep: missing heartbeat for more than 10 minutes",
        finishedAt: now,
        lockedBy: null,
        lockedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      staleTimeoutMs: STALE_TIMEOUT_MS,
      sweptCount: result.count,
      sweptAt: now.toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to sweep stale jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
