import { getPrisma } from "@scraping-platform/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await context.params;
    const prisma = getPrisma();

    const current = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        retryCount: true,
        maxRetry: true,
      },
    });

    if (!current) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (current.status !== "FAILED") {
      return NextResponse.json(
        { error: "Only FAILED jobs can be retried" },
        { status: 400 },
      );
    }

    if (current.retryCount >= current.maxRetry) {
      return NextResponse.json(
        { error: "Retry limit reached for this job" },
        { status: 400 },
      );
    }

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "PENDING",
        progress: 0,
        retryScheduledFor: new Date(),
        lockedBy: null,
        lockedAt: null,
        blockedReason: null,
        errorDetail: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
      },
    });

    return NextResponse.json({ success: true, jobId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retry job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
