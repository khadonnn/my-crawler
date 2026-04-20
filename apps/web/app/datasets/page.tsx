"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";

import { Button } from "@/components/ui/button";

type PostRow = {
  id: string;
  fbPostId: string;
  postUrl: string;
  authorName: string;
  content: string | null;
  scrapedAt: string;
  reactionCount: number;
};

type ReactionRow = {
  id: string;
  type: string;
  reactionType: string | null;
  commentText: string | null;
  interactedAt: string | null;
  scrapedAt: string;
  profile: {
    id: string;
    fbUid: string;
    name: string;
    profileUrl: string;
  };
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return payload as T;
};

async function waitForJobCompletion(jobId: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const jobs = await fetcher<
      Array<{
        id: string;
        status: string;
      }>
    >("/api/jobs");

    const job = jobs.find((item) => item.id === jobId);
    if (!job) {
      throw new Error("Khong tim thay job vua tao");
    }

    if (job.status === "COMPLETED") {
      return;
    }

    if (job.status === "FAILED" || job.status === "CANCELLED") {
      throw new Error(`Crawl that bai (${job.status})`);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });
  }

  throw new Error("Crawl reactions timeout");
}

async function triggerReactionsCrawl(
  postId: string,
): Promise<{ jobId: string }> {
  const response = await fetch("/api/crawl/reactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ postId }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    jobId?: string;
  };

  if (!response.ok || !payload.jobId) {
    throw new Error(payload.error ?? "Khong the trigger reactions crawl");
  }

  return { jobId: payload.jobId };
}

export default function DatasetsPage() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [loadingReactions, setLoadingReactions] = useState(false);
  const [reactionError, setReactionError] = useState<string | null>(null);

  const postsEndpoint = useMemo(
    () => (jobId ? `/api/posts?jobId=${encodeURIComponent(jobId)}` : null),
    [jobId],
  );

  const {
    data: posts,
    isLoading,
    mutate,
  } = useSWR<PostRow[]>(
    postsEndpoint,
    (url: string) => fetcher<PostRow[]>(url),
    {
      revalidateOnFocus: false,
    },
  );

  async function loadReactionsWithAutoCrawl(postId: string) {
    setSelectedPostId(postId);
    setLoadingReactions(true);
    setReactionError(null);

    try {
      const initial = await fetcher<{ reactions: ReactionRow[] }>(
        `/posts/${postId}/reactions`,
      );

      if (initial.reactions.length > 0) {
        setReactions(initial.reactions);
        return;
      }

      const crawl = await triggerReactionsCrawl(postId);

      await waitForJobCompletion(crawl.jobId);
      await mutate();

      const after = await fetcher<{ reactions: ReactionRow[] }>(
        `/posts/${postId}/reactions`,
      );
      setReactions(after.reactions);
    } catch (error) {
      setReactionError(
        error instanceof Error ? error.message : "Khong the tai reactions",
      );
      setReactions([]);
    } finally {
      setLoadingReactions(false);
    }
  }

  return (
    <section className="space-y-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Datasets</h1>
      <p className="text-muted-foreground">
        Browse and manage extracted datasets from crawler runs.
      </p>
      {jobId ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          Dang xem du lieu cua job: {jobId}
        </p>
      ) : null}

      {!jobId ? (
        <p className="text-sm text-muted-foreground">
          Chon mot job tu trang Crawlers de xem posts va reactions.
        </p>
      ) : null}

      {jobId && isLoading ? (
        <p className="text-sm text-muted-foreground">
          Dang tai danh sach posts...
        </p>
      ) : null}

      {jobId && posts && posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Job nay chua co post nao trong database.
        </p>
      ) : null}

      {jobId && posts && posts.length > 0 ? (
        <div className="space-y-3 rounded-lg border p-3">
          <h2 className="font-medium">Posts</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Author</th>
                  <th className="px-3 py-2 text-left font-medium">Content</th>
                  <th className="px-3 py-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b">
                    <td className="px-3 py-2">
                      <div className="font-medium">{post.authorName}</div>
                      <div className="text-xs text-muted-foreground">
                        {post.fbPostId}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <p className="max-w-xl truncate">
                        {post.content ?? "(empty)"}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={
                          loadingReactions && selectedPostId === post.id
                        }
                        onClick={() => void loadReactionsWithAutoCrawl(post.id)}
                      >
                        {loadingReactions && selectedPostId === post.id
                          ? "Loading..."
                          : "View Reactions"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {selectedPostId ? (
        <div className="space-y-3 rounded-lg border p-3">
          <h2 className="font-medium">Reactions</h2>

          {loadingReactions ? (
            <p className="text-sm text-muted-foreground">
              Chua co data, dang trigger crawl va cho hoan tat...
            </p>
          ) : null}

          {reactionError ? (
            <p className="text-sm text-destructive">{reactionError}</p>
          ) : null}

          {!loadingReactions && !reactionError && reactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chua co reactions sau khi crawl.
            </p>
          ) : null}

          {!loadingReactions && reactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">User</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {reactions.map((reaction) => (
                    <tr key={reaction.id} className="border-b">
                      <td className="px-3 py-2">{reaction.profile.name}</td>
                      <td className="px-3 py-2">{reaction.type}</td>
                      <td className="px-3 py-2">
                        {reaction.reactionType ?? reaction.commentText ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
