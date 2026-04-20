import { getPrisma } from "@scraping-platform/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ALLOWED_STATUS = new Set(["ACTIVE", "DISABLED"]);

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const status =
      typeof body?.status === "string" ? body.status.trim().toUpperCase() : "";

    if (!ALLOWED_STATUS.has(status)) {
      return NextResponse.json(
        { error: "status must be ACTIVE or DISABLED" },
        { status: 400 },
      );
    }

    const prisma = getPrisma();
    await prisma.account.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const prisma = getPrisma();
    await prisma.account.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
