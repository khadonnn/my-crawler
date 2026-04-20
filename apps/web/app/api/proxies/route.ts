import { getPrisma } from "@scraping-platform/db";
import { NextRequest, NextResponse } from "next/server";

type ProxyRegion = "ANY" | "VN" | "US";

function normalizeProxyRegion(value: unknown): ProxyRegion {
  if (typeof value !== "string") {
    return "ANY";
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "VN" || normalized === "US" || normalized === "ANY") {
    return normalized;
  }

  return "ANY";
}

async function hasProxyRegionColumn(prisma: ReturnType<typeof getPrisma>) {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'Proxy'
        AND column_name = 'region'
    ) AS "exists"`,
  );

  return Boolean(rows[0]?.exists);
}

export async function GET() {
  try {
    const prisma = getPrisma();

    const regionColumnExists = await hasProxyRegionColumn(prisma);
    if (regionColumnExists) {
      const proxies = await prisma.proxy.findMany({
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(proxies);
    }

    const proxies = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        address: string;
        port: number;
        region: string;
        status: string;
        latency: number;
        createdAt: Date;
      }>
    >(
      `SELECT
        "id",
        "address",
        "port",
        'ANY' AS "region",
        "status",
        "latency",
        "createdAt"
      FROM "Proxy"
      ORDER BY "createdAt" DESC`,
    );

    return NextResponse.json(proxies);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to fetch proxies",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrisma();
    const body = await request.json();

    const { address, port, username, password, protocol, region } = body;
    const normalizedRegion = normalizeProxyRegion(region);

    if (!address || !port) {
      return NextResponse.json(
        { error: "Missing required fields: address, port" },
        { status: 400 },
      );
    }

    const regionColumnExists = await hasProxyRegionColumn(prisma);
    const proxyData = regionColumnExists
      ? {
          username,
          password,
          protocol,
          region: normalizedRegion,
        }
      : {
          username,
          password,
          protocol,
        };
    const createData = regionColumnExists
      ? {
          address,
          port,
          username,
          password,
          protocol,
          region: normalizedRegion,
        }
      : {
          address,
          port,
          username,
          password,
          protocol,
        };

    const proxy = await prisma.proxy.upsert({
      where: { address_port: { address, port } },
      update: proxyData,
      create: createData,
    });

    return NextResponse.json(proxy, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create proxy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const prisma = getPrisma();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing proxy id" }, { status: 400 });
    }

    await prisma.proxy.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete proxy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
