import { getPrisma } from "@scraping-platform/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const prisma = getPrisma();
    const job = await prisma.job.findUnique({ where: { id: jobId } });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;

    const prisma = getPrisma();
    await prisma.job.delete({ where: { id: jobId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
