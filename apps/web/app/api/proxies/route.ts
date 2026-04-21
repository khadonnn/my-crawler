import { getPrisma } from "@scraping-platform/db";
import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";

type ProxyRegion = "ANY" | "VN" | "US";
type ProxyLocation = {
  countryCode: string;
  region: ProxyRegion;
};

type GeoIpLike = {
  lookup: (ip: string) => { country?: string } | null;
};

let cachedGeoIpModule: GeoIpLike | null = null;

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

function normalizeCountryCode(value: unknown): string {
  if (typeof value !== "string") {
    return "UNKNOWN";
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : "UNKNOWN";
}

function mapCountryCodeToLegacyRegion(countryCode: string): ProxyRegion {
  return countryCode === "VN" ? "VN" : countryCode === "US" ? "US" : "ANY";
}

async function importGeoIp(): Promise<GeoIpLike> {
  if (cachedGeoIpModule) {
    return cachedGeoIpModule;
  }

  const module = (await import("geoip-lite")) as unknown as {
    default?: GeoIpLike;
    lookup?: GeoIpLike["lookup"];
  };
  if (module.default?.lookup) {
    cachedGeoIpModule = module.default;
    return cachedGeoIpModule;
  }

  if (module.lookup) {
    cachedGeoIpModule = { lookup: module.lookup };
    return cachedGeoIpModule;
  }

  throw new Error("geoip-lite module missing lookup function");
}

async function detectProxyLocation(address: string): Promise<ProxyLocation> {
  if (!address || isIP(address) === 0) {
    return {
      countryCode: "UNKNOWN",
      region: "ANY",
    };
  }

  try {
    const geoip = await importGeoIp();
    const lookup = geoip.lookup(address);
    const countryCode = normalizeCountryCode(lookup?.country);
    return {
      countryCode,
      region: mapCountryCodeToLegacyRegion(countryCode),
    };
  } catch {
    return {
      countryCode: "UNKNOWN",
      region: "ANY",
    };
  }
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

async function hasProxyCountryCodeColumn(prisma: ReturnType<typeof getPrisma>) {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'Proxy'
        AND column_name = 'countryCode'
    ) AS "exists"`,
  );

  return Boolean(rows[0]?.exists);
}

export async function GET() {
  try {
    const prisma = getPrisma();

    const [regionColumnExists, countryCodeColumnExists] = await Promise.all([
      hasProxyRegionColumn(prisma),
      hasProxyCountryCodeColumn(prisma),
    ]);

    if (regionColumnExists && countryCodeColumnExists) {
      const proxies = await prisma.proxy.findMany({
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(proxies);
    }

    const proxies = regionColumnExists
      ? await prisma.$queryRawUnsafe<
          Array<{
            id: string;
            address: string;
            port: number;
            region: string;
            countryCode: string;
            status: string;
            latency: number;
            createdAt: Date;
          }>
        >(
          `SELECT
            "id",
            "address",
            "port",
            "region",
            'UNKNOWN' AS "countryCode",
            "status",
            "latency",
            "createdAt"
          FROM "Proxy"
          ORDER BY "createdAt" DESC`,
        )
      : countryCodeColumnExists
        ? await prisma.$queryRawUnsafe<
            Array<{
              id: string;
              address: string;
              port: number;
              region: string;
              countryCode: string;
              status: string;
              latency: number;
              createdAt: Date;
            }>
          >(
            `SELECT
              "id",
              "address",
              "port",
              CASE
                WHEN "countryCode" = 'VN' THEN 'VN'
                WHEN "countryCode" = 'US' THEN 'US'
                ELSE 'ANY'
              END AS "region",
              "countryCode",
              "status",
              "latency",
              "createdAt"
            FROM "Proxy"
            ORDER BY "createdAt" DESC`,
          )
        : await prisma.$queryRawUnsafe<
            Array<{
              id: string;
              address: string;
              port: number;
              region: string;
              countryCode: string;
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
              'UNKNOWN' AS "countryCode",
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

    const { address, port, username, password, protocol, region, countryCode } =
      body;
    const detectedLocation = await detectProxyLocation(String(address ?? ""));
    const normalizedCountryCode =
      typeof countryCode === "string" && countryCode.trim().length > 0
        ? normalizeCountryCode(countryCode)
        : detectedLocation.countryCode;
    const hasProvidedRegion =
      typeof region === "string" && region.trim().length > 0;
    const normalizedRegion = hasProvidedRegion
      ? normalizeProxyRegion(region)
      : mapCountryCodeToLegacyRegion(normalizedCountryCode);

    if (!address || !port) {
      return NextResponse.json(
        { error: "Missing required fields: address, port" },
        { status: 400 },
      );
    }

    const [regionColumnExists, countryCodeColumnExists] = await Promise.all([
      hasProxyRegionColumn(prisma),
      hasProxyCountryCodeColumn(prisma),
    ]);

    const baseData = {
      username,
      password,
      protocol,
    };

    const proxyData = {
      ...baseData,
      ...(regionColumnExists ? { region: normalizedRegion } : {}),
      ...(countryCodeColumnExists
        ? { countryCode: normalizedCountryCode }
        : {}),
    };

    const createData = {
      address,
      port,
      ...baseData,
      ...(regionColumnExists ? { region: normalizedRegion } : {}),
      ...(countryCodeColumnExists
        ? { countryCode: normalizedCountryCode }
        : {}),
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
