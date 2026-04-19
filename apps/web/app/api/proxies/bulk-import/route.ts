import { getPrisma } from "@scraping-platform/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrisma();
    const body = await request.json();
    const { proxyList } = body;

    if (!Array.isArray(proxyList) || proxyList.length === 0) {
      return NextResponse.json(
        { error: "proxyList must be a non-empty array" },
        { status: 400 },
      );
    }

    const results = [];
    const errors = [];

    for (const proxyStr of proxyList) {
      const parts = proxyStr.trim().split(":");

      if (parts.length < 2) {
        errors.push({
          proxy: proxyStr,
          error: "Invalid format (need ip:port[:user[:pass]])",
        });
        continue;
      }

      const [address, portStr, username, password] = parts;
      const port = parseInt(portStr, 10);

      if (isNaN(port)) {
        errors.push({ proxy: proxyStr, error: "Invalid port number" });
        continue;
      }

      try {
        const proxy = await prisma.proxy.upsert({
          where: { address_port: { address, port } },
          update: { username: username || null, password: password || null },
          create: {
            address,
            port,
            username: username || null,
            password: password || null,
          },
        });

        results.push(proxy);
      } catch (err) {
        errors.push({
          proxy: proxyStr,
          error: err instanceof Error ? err.message : "Database error",
        });
      }
    }

    return NextResponse.json(
      {
        imported: results.length,
        failed: errors.length,
        results,
        errors,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to import proxies",
      },
      { status: 500 },
    );
  }
}
