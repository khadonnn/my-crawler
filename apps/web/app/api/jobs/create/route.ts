import { NextRequest, NextResponse } from "next/server";

import { createCrawlerJob } from "@/lib/server/jobs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      url?: string;
      keyword?: string;
      scrapeMode?: "PROFILE_ONLY" | "POST_ONLY" | "PROFILE_AND_POST";
      proxyRegion?: "ANY" | "VN" | "US";
      schedule?: string;
      debugMode?: boolean;
    };
    const { url } = body;

    if (!url || !/^https?:\/\//.test(url)) {
      return NextResponse.json({ error: "URL không hợp lệ" }, { status: 400 });
    }

    const created = await createCrawlerJob({
      url,
      keyword: body.keyword,
      scrapeMode: body.scrapeMode,
      proxyRegion: body.proxyRegion,
      schedule: body.schedule,
      debugMode: body.debugMode,
    });

    return NextResponse.json(
      {
        success: true,
        jobId: created.job.id,
        workerId: created.workerId,
        message: "Job created successfully",
      },
      { status: 202 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
