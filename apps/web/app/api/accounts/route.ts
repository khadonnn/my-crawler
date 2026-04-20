import { getPrisma } from "@scraping-platform/db";
import type { InputJsonValue } from "@prisma/client/runtime/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const prisma = getPrisma();
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        platform: true,
        status: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizePlatform(platform: unknown): string {
  if (typeof platform !== "string" || !platform.trim()) {
    return "facebook";
  }

  return platform.trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const platform = normalizePlatform(body?.platform);
    const sessionDataRaw = body?.sessionData;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (typeof sessionDataRaw !== "string" || !sessionDataRaw.trim()) {
      return NextResponse.json(
        { error: "sessionData must be a non-empty JSON string" },
        { status: 400 },
      );
    }

    let sessionData: InputJsonValue;
    try {
      const parsed = JSON.parse(sessionDataRaw) as unknown;
      if (!parsed || typeof parsed !== "object") {
        return NextResponse.json(
          { error: "sessionData must be a JSON object" },
          { status: 400 },
        );
      }

      sessionData = parsed as InputJsonValue;
    } catch {
      return NextResponse.json(
        { error: "sessionData is not valid JSON" },
        { status: 400 },
      );
    }

    const prisma = getPrisma();
    await prisma.account.create({
      data: {
        name,
        platform,
        sessionData,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
