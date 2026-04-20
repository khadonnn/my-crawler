import { getPrisma } from "@scraping-platform/db";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const prisma = getPrisma();
    const post = await prisma.post.findFirst({
      where: {
        OR: [{ id }, { fbPostId: id }],
      },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const reactions = await prisma.interaction.findMany({
      where: { postId: post.id },
      orderBy: { scrapedAt: "desc" },
      take: 200,
      select: {
        id: true,
        type: true,
        reactionType: true,
        commentText: true,
        interactedAt: true,
        scrapedAt: true,
        profile: {
          select: {
            id: true,
            fbUid: true,
            name: true,
            profileUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      postId: post.id,
      reactions: reactions.map((item) => ({
        id: item.id,
        type: item.type,
        reactionType: item.reactionType,
        commentText: item.commentText,
        interactedAt: item.interactedAt?.toISOString() ?? null,
        scrapedAt: item.scrapedAt.toISOString(),
        profile: item.profile,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch reactions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
