import { getPrisma } from "@scraping-platform/db";
import { NextRequest, NextResponse } from "next/server";

const FALLBACK_WORKER_URL = "http://localhost:10000";

function getWorkerUrl() {
  return process.env.WORKER_API_BASE_URL ?? FALLBACK_WORKER_URL;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || !/^https?:\/\//.test(url)) {
      return NextResponse.json({ error: "URL không hợp lệ" }, { status: 400 });
    }

    const workerUrl = getWorkerUrl();

    // Gọi Worker API để tạo job
    const workerResponse = await fetch(`${workerUrl}/api/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!workerResponse.ok) {
      const error = await workerResponse.json();
      throw new Error(error?.error ?? "Worker error");
    }

    const workerData = await workerResponse.json();
    const jobId = workerData.jobId;

    // Tạo Job record trong database
    const prisma = getPrisma();
    const job = await prisma.job.create({
      data: {
        sourceType: "GROUP_URL",
        sourceValue: url,
        status: "PENDING",
        progress: 0,
      },
    });

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        workerId: jobId,
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
