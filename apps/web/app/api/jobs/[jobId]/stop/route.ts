import { NextRequest, NextResponse } from "next/server";

import { stopCrawlerJob } from "@/lib/server/jobs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await context.params;
    const stopped = await stopCrawlerJob(jobId);

    if (!stopped) {
      return NextResponse.json(
        { error: "Job khong the dung hoac da ket thuc" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to stop job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
