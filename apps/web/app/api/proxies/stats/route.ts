import { getPrisma } from "@scraping-platform/db";
import { NextResponse } from "next/server";

type CountryStat = {
  countryCode: string;
  count: number;
};

async function hasColumn(
  prisma: ReturnType<typeof getPrisma>,
  columnName: string,
): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'Proxy'
        AND column_name = $1
    ) AS "exists"`,
    columnName,
  );

  return Boolean(rows[0]?.exists);
}

export async function GET() {
  try {
    const prisma = getPrisma();
    const [hasCountryCode, hasRegion] = await Promise.all([
      hasColumn(prisma, "countryCode"),
      hasColumn(prisma, "region"),
    ]);

    let countries: CountryStat[] = [];

    if (hasCountryCode) {
      const grouped = await prisma.proxy.groupBy({
        by: ["countryCode"],
        where: { status: "WORKING" },
        _count: { _all: true },
        orderBy: { countryCode: "asc" },
      });

      countries = grouped.map((row) => ({
        countryCode: row.countryCode,
        count: row._count._all,
      }));
    } else if (hasRegion) {
      const grouped = await prisma.proxy.groupBy({
        by: ["region"],
        where: { status: "WORKING" },
        _count: { _all: true },
      });

      countries = grouped.map((row) => ({
        countryCode: row.region === "ANY" ? "UNKNOWN" : row.region,
        count: row._count._all,
      }));
    }

    const totalWorking = countries.reduce((sum, row) => sum + row.count, 0);

    return NextResponse.json({
      totalWorking,
      countries,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to fetch proxy country stats",
      },
      { status: 500 },
    );
  }
}
