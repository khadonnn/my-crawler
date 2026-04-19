import { getPrisma } from "@scraping-platform/db";
import { NextRequest, NextResponse } from "next/server";

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
      let status = "UNKNOWN";

      try {
        const testResponse = await fetch("http://example.com", {
          method: "HEAD",
          ...(proxy.username && {
            headers: {
              "Proxy-Authorization": `Basic ${Buffer.from(`${proxy.username}:${proxy.password || ""}`).toString("base64")}`,
            },
          }),
          timeout: 5000,
        }).catch(() => null);

        status = testResponse && testResponse.ok ? "WORKING" : "DEAD";
      } catch {
        status = "DEAD";
      }

      const updated = await prisma.proxy.update({
        where: { id: proxy.id },
        data: {
          status,
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
