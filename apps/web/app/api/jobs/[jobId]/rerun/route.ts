import { NextRequest, NextResponse } from "next/server";

import { rerunCrawlerJob } from "@/lib/server/jobs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await context.params;
    const created = await rerunCrawlerJob(jobId);

    return NextResponse.json(
      {
        success: true,
        jobId: created.job.id,
        workerId: created.workerId,
      },
      { status: 202 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to rerun job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
