import { getPrisma } from "@scraping-platform/db";
import { checkProxyHealth } from "@/lib/server/proxy-health";
import { NextResponse } from "next/server";
import { isIP } from "node:net";

export const runtime = "nodejs";

type GeoIpLike = {
  lookup: (ip: string) => { country?: string } | null;
};

let cachedGeoIpModule: GeoIpLike | null = null;

type ProxyRegion = "ANY" | "VN" | "US";

type ParsedProxy = {
  address: string;
  port: number;
  username: string | null;
  password: string | null;
  countryCode: string;
  region: ProxyRegion;
  hasExplicitRegion: boolean;
  status: "UNKNOWN";
};

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

async function detectProxyLocation(address: string): Promise<{
  countryCode: string;
  region: ProxyRegion;
}> {
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

function deduplicateRows(rows: ParsedProxy[]): ParsedProxy[] {
  const unique = new Map<string, ParsedProxy>();

  for (const row of rows) {
    unique.set(`${row.address}:${row.port}`, row);
  }

  return Array.from(unique.values());
}

function normalizeProxyList(proxyList: unknown): string[] {
  if (!Array.isArray(proxyList)) {
    return [];
  }

  return proxyList
    .filter((item): item is string => typeof item === "string")
    .flatMap((item) => item.split(/[\r\n;]+/g))
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseProxyLine(line: string): ParsedProxy | null {
  const parts = line
    .split(":")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  const [address, portRaw, ...rest] = parts;
  const port = Number.parseInt(portRaw, 10);

  if (!address || Number.isNaN(port)) {
    return null;
  }

  let region: ProxyRegion = "ANY";
  let credentialParts = rest;
  let hasExplicitRegion = false;

  if (rest.length > 0) {
    const last = normalizeProxyRegion(rest[rest.length - 1]);
    if (last !== "ANY" || rest[rest.length - 1].toUpperCase() === "ANY") {
      region = last;
      hasExplicitRegion = true;
      credentialParts = rest.slice(0, -1);
    }
  }

  // Support formats:
  // - ip:port
  // - ip:port:username:password
  // - ip:port:region
  // - ip:port:username:password:region
  const [usernameRaw, passwordRaw] = credentialParts;

  return {
    address,
    port,
    username: usernameRaw || null,
    password: passwordRaw || null,
    countryCode: "UNKNOWN",
    region,
    hasExplicitRegion,
    status: "UNKNOWN",
  };
}

export async function POST(req: Request) {
  try {
    const { proxyList } = await req.json();
    const prisma = getPrisma();
    const [regionColumnExists, countryCodeColumnExists] = await Promise.all([
      hasProxyRegionColumn(prisma),
      hasProxyCountryCodeColumn(prisma),
    ]);

    const normalizedLines = normalizeProxyList(proxyList);
    if (normalizedLines.length === 0) {
      return NextResponse.json(
        { error: "proxyList must be a non-empty array of proxy strings" },
        { status: 400 },
      );
    }

    let invalidCount = 0;
    const parsedRows = normalizedLines
      .map((line) => {
        const parsed = parseProxyLine(line);
        if (!parsed) {
          invalidCount += 1;
        }
        return parsed;
      })
      .filter((row): row is ParsedProxy => row !== null);

    const uniqueRows = deduplicateRows(parsedRows);
    const rowsWithLocation = await Promise.all(
      uniqueRows.map(async (row) => {
        const detectedLocation = await detectProxyLocation(row.address);
        const countryCode = detectedLocation.countryCode;
        const region = row.hasExplicitRegion
          ? row.region
          : mapCountryCodeToLegacyRegion(countryCode);

        return {
          ...row,
          countryCode,
          region,
        };
      }),
    );

    let imported = 0;
    if (rowsWithLocation.length > 0) {
      try {
        const result = await prisma.proxy.createMany({
          data: rowsWithLocation.map((row) => ({
            address: row.address,
            port: row.port,
            username: row.username,
            password: row.password,
            status: row.status,
            ...(regionColumnExists ? { region: row.region } : {}),
            ...(countryCodeColumnExists
              ? { countryCode: row.countryCode }
              : {}),
          })),
          skipDuplicates: true,
        });
        imported = result.count;
      } catch {
        // Fallback for environments where bulk insert may fail unexpectedly.
        for (const row of rowsWithLocation) {
          try {
            await prisma.proxy.create({
              data: {
                address: row.address,
                port: row.port,
                username: row.username,
                password: row.password,
                status: row.status,
                ...(regionColumnExists ? { region: row.region } : {}),
                ...(countryCodeColumnExists
                  ? { countryCode: row.countryCode }
                  : {}),
              },
            });
            imported += 1;
          } catch {
            // Ignore row-level insert errors (often duplicates).
          }
        }
      }
    }

    const failed = invalidCount + (rowsWithLocation.length - imported);

    // Auto-check newly imported (and matching existing) proxies so UI can show WORKING/DEAD quickly.
    const candidates = await prisma.proxy.findMany({
      where: {
        OR: uniqueRows.map((row) => ({ address: row.address, port: row.port })),
      },
      select: { id: true, address: true, port: true },
    });

    let checked = 0;
    for (const proxy of candidates) {
      const health = await checkProxyHealth(proxy.address, proxy.port);
      await prisma.proxy.update({
        where: { id: proxy.id },
        data: {
          status: health.status,
          latency: health.latency,
          lastChecked: new Date(),
        },
      });
      checked += 1;
    }

    return NextResponse.json({
      imported,
      failed,
      checked,
      results: [],
      errors: [],
    });
  } catch {
    return NextResponse.json({ error: "Loi Server" }, { status: 500 });
  }
}
