import { NextRequest, NextResponse } from "next/server";

import { createCrawlerJob, listCrawlerJobs } from "@/lib/server/jobs";

export async function GET() {
  try {
    const jobs = await listCrawlerJobs(150);
    return NextResponse.json(jobs);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      strategy?: "FACEBOOK_DIRECT" | "FACEBOOK_SEARCH";
      url?: string;
      keyword?: string;
      platform?: "FACEBOOK" | "GOOGLE" | "YOUTUBE" | "TIKTOK";
      mode?: "DIRECT_URL" | "SEARCH_KEYWORD";
      scrapeMode?: "PROFILE_ONLY" | "POST_ONLY" | "PROFILE_AND_POST";
      proxyRegion?: "ANY" | "VN" | "US";
      selectedProxyId?: string;
      targetCountry?: string;
      schedule?: string;
      debugMode?: boolean;
    };

    const platform =
      body.strategy === "FACEBOOK_DIRECT" || body.strategy === "FACEBOOK_SEARCH"
        ? "FACEBOOK"
        : (body.platform ?? "FACEBOOK");
    const mode =
      body.strategy === "FACEBOOK_SEARCH"
        ? "SEARCH_KEYWORD"
        : body.strategy === "FACEBOOK_DIRECT"
          ? "DIRECT_URL"
          : (body.mode ?? "DIRECT_URL");
    const url = body.url?.trim();
    const keyword = body.keyword?.trim();

    if (mode === "DIRECT_URL" && (!url || !/^https?:\/\//.test(url))) {
      return NextResponse.json(
        { error: "DIRECT_URL requires valid url" },
        { status: 400 },
      );
    }

    if (mode === "SEARCH_KEYWORD" && !keyword) {
      return NextResponse.json(
        { error: "SEARCH_KEYWORD requires keyword" },
        { status: 400 },
      );
    }

    const created = await createCrawlerJob({
      url,
      keyword,
      platform,
      mode,
      scrapeMode: body.scrapeMode,
      proxyRegion: body.proxyRegion,
      selectedProxyId: body.selectedProxyId,
      targetCountry: body.targetCountry,
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
