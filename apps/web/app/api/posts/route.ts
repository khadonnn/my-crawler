import { getPrisma } from "@scraping-platform/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId")?.trim();

    const prisma = getPrisma();
    const posts = await prisma.post.findMany({
      where: jobId ? { jobId } : undefined,
      orderBy: { scrapedAt: "desc" },
      take: 100,
      select: {
        id: true,
        fbPostId: true,
        postUrl: true,
        authorName: true,
        content: true,
        scrapedAt: true,
        _count: {
          select: {
            interactions: true,
          },
        },
      },
    });

    return NextResponse.json(
      posts.map((post) => ({
        id: post.id,
        fbPostId: post.fbPostId,
        postUrl: post.postUrl,
        authorName: post.authorName,
        content: post.content,
        scrapedAt: post.scrapedAt.toISOString(),
        reactionCount: post._count.interactions,
      })),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch posts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
