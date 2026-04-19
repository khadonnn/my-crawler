import { getPrisma } from "@scraping-platform/db";
import { checkProxyHealth } from "@/lib/server/proxy-health";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrisma();
    const body = await request.json();
    const { proxyIds } = body;

    if (!Array.isArray(proxyIds) || proxyIds.length === 0) {
      return NextResponse.json(
        { error: "proxyIds must be a non-empty array" },
        { status: 400 },
      );
    }

    const proxies = await prisma.proxy.findMany({
      where: { id: { in: proxyIds } },
    });

    const updates = [];

    for (const proxy of proxies) {
      const health = await checkProxyHealth(proxy.address, proxy.port);

      const updated = await prisma.proxy.update({
        where: { id: proxy.id },
        data: {
          status: health.status,
          latency: health.latency,
          lastChecked: new Date(),
        },
      });

      updates.push(updated);
    }

    return NextResponse.json(
      {
        checked: updates.length,
        updates,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to check proxy health",
      },
      { status: 500 },
    );
  }
}
