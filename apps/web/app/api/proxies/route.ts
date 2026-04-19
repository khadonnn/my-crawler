import { getPrisma } from "@scraping-platform/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const prisma = getPrisma();
    const proxies = await prisma.proxy.findMany({
      orderBy: { createdAt: "desc" },
    });

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

    const { address, port, username, password, protocol } = body;

    if (!address || !port) {
      return NextResponse.json(
        { error: "Missing required fields: address, port" },
        { status: 400 },
      );
    }

    const proxy = await prisma.proxy.upsert({
      where: { address_port: { address, port } },
      update: { username, password, protocol },
      create: { address, port, username, password, protocol },
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
