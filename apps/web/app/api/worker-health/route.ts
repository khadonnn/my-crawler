import { NextResponse } from "next/server";

const defaultWorkerUrl = "http://localhost:10000";

function getWorkerUrl() {
  return process.env.WORKER_API_BASE_URL ?? defaultWorkerUrl;
}

export async function GET() {
  const baseUrl = getWorkerUrl();

  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          online: false,
          status: "offline",
          checkedAt: new Date().toISOString(),
          message: `Worker returned ${response.status}`,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      online: true,
      status: "online",
      checkedAt: new Date().toISOString(),
      baseUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        online: false,
        status: "offline",
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Worker unreachable",
      },
      { status: 200 },
    );
  }
}
