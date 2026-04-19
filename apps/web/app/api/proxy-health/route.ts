import { getPrisma } from "@scraping-platform/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const prisma = getPrisma();
    const [total, working] = await Promise.all([
      prisma.proxy.count(),
      prisma.proxy.count({
        where: {
          status: "WORKING",
        },
      }),
    ]);

    const liveRate = total > 0 ? Math.round((working / total) * 100) : 0;

    return NextResponse.json({
      total,
      working,
      liveRate,
      hasData: total > 0,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        total: 0,
        working: 0,
        liveRate: 0,
        hasData: false,
        checkedAt: new Date().toISOString(),
        message:
          error instanceof Error
            ? error.message
            : "Unable to load proxy health",
      },
      { status: 200 },
    );
  }
}
