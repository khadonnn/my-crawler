import { NextResponse } from "next/server";

import { createReactionsCrawlJob } from "@/lib/server/jobs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { postId?: string };
    const postId = body.postId?.trim();

    if (!postId) {
      return NextResponse.json(
        { error: "postId is required" },
        { status: 400 },
      );
    }

    const created = await createReactionsCrawlJob(postId);

    return NextResponse.json(
      {
        success: true,
        jobId: created.jobId,
        workerId: created.workerId,
        postId: created.postId,
      },
      { status: 202 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to trigger reactions crawl";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
