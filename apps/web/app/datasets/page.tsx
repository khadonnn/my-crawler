"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

type PostRow = {
  id: string;
  fbPostId: string;
  postUrl: string;
  authorName: string;
  content: string | null;
  scrapedAt: string;
  reactionCount: number;
};

type JobRow = {
  id: string;
  status: string;
  progress: number;
  sourceValue: string;
  leadCount: number;
  processedCount: number;
  blockedReason: string | null;
  errorDetail: string | null;
  retryCount: number;
  maxRetry: number;
  retryScheduledFor: string | null;
  lockedBy: string | null;
  lockedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
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

function formatDuration(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function statusBadgeTone(status: string) {
  if (status === "RUNNING") {
    return "bg-blue-500/20 text-blue-700";
  }

  if (status === "COMPLETED") {
    return "bg-emerald-500/20 text-emerald-700";
  }

  if (status === "FAILED") {
    return "bg-red-500/20 text-red-700";
  }

  if (status === "CANCELLED") {
    return "bg-zinc-500/20 text-zinc-700";
  }

  return "bg-amber-500/20 text-amber-700";
}

function formatTimelineTime(value: string | null) {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(parsed);
}

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [loadingReactions, setLoadingReactions] = useState(false);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletingJob, setDeletingJob] = useState(false);

  const postsEndpoint = useMemo(
    () => (jobId ? `/api/posts?jobId=${encodeURIComponent(jobId)}` : null),
    [jobId],
  );

  const { data: jobs, isLoading: jobsLoading } = useSWR<JobRow[]>(
    "/api/jobs",
    (url: string) => fetcher<JobRow[]>(url),
    {
      refreshInterval: 10_000,
      revalidateOnFocus: false,
    },
  );

  const selectedJob = useMemo(() => {
    if (!jobId || !jobs) {
      return null;
    }

    return jobs.find((item) => item.id === jobId) ?? null;
  }, [jobId, jobs]);

  const isJobRunning =
    selectedJob?.status === "RUNNING" || selectedJob?.status === "PENDING";

  useEffect(() => {
    if (!isJobRunning) {
      return;
    }

    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isJobRunning]);

  const jobProgressValue = useMemo(() => {
    if (!selectedJob) {
      return 0;
    }

    return Math.min(100, Math.max(0, selectedJob.progress ?? 0));
  }, [selectedJob]);

  const estimatedRemainingText = useMemo(() => {
    if (!selectedJob || !isJobRunning) {
      return null;
    }

    const createdTime = new Date(selectedJob.createdAt).getTime();
    if (Number.isNaN(createdTime)) {
      return "Đang ước lượng...";
    }

    const elapsedMs = Math.max(0, nowTick - createdTime);
    if (jobProgressValue <= 0) {
      return `Đã chạy: ${formatDuration(elapsedMs)}`;
    }

    if (jobProgressValue >= 100) {
      return "Sắp hoàn tất";
    }

    if (jobProgressValue >= 45 && selectedJob.status === "RUNNING") {
      return "Đang quét sâu comments/reactions, thời gian có thể dao động";
    }

    const estimatedTotalMs = (elapsedMs / jobProgressValue) * 100;
    const remainingMs = Math.max(0, estimatedTotalMs - elapsedMs);
    return `Còn lại ước tính: ${formatDuration(remainingMs)}`;
  }, [isJobRunning, jobProgressValue, nowTick, selectedJob]);

  const lastUpdatedAgoText = useMemo(() => {
    if (!selectedJob) {
      return null;
    }

    const updatedAtMs = new Date(selectedJob.updatedAt).getTime();
    if (Number.isNaN(updatedAtMs)) {
      return null;
    }

    return formatDuration(Math.max(0, nowTick - updatedAtMs));
  }, [nowTick, selectedJob]);

  const isLikelyStuck = useMemo(() => {
    if (!selectedJob || !isJobRunning) {
      return false;
    }

    const updatedAtMs = new Date(selectedJob.updatedAt).getTime();
    if (Number.isNaN(updatedAtMs)) {
      return false;
    }

    return nowTick - updatedAtMs > 5 * 60 * 1000;
  }, [isJobRunning, nowTick, selectedJob]);

  const visualProgressValue = useMemo(() => {
    if (!isJobRunning || jobProgressValue > 0) {
      return jobProgressValue;
    }

    // Give users a visible heartbeat when backend progress is still 0.
    return 10 + (Math.floor(nowTick / 1000) % 5) * 3;
  }, [isJobRunning, jobProgressValue, nowTick]);

  async function handleDeleteJob() {
    if (!jobId) {
      return;
    }

    setDeletingJob(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Không thể xóa job");
      }

      toast.success("Đã xóa job bị kẹt");
      setOpenDeleteDialog(false);
      router.push("/crawlers");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xóa job thất bại");
    } finally {
      setDeletingJob(false);
    }
  }

  const {
    data: posts,
    isLoading,
    error: postsError,
    mutate,
  } = useSWR<PostRow[]>(
    postsEndpoint,
    (url: string) => fetcher<PostRow[]>(url),
    {
      revalidateOnFocus: false,
      refreshInterval: isJobRunning ? 5_000 : 0,
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
          Đang xem dữ liệu của job: {jobId}
        </p>
      ) : null}

      {jobId && !jobsLoading && !selectedJob ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          Không tìm thấy job này trong hệ thống. Có thể job đã bị xóa hoặc đã
          quá cũ nên không còn trong danh sách gần đây.
        </p>
      ) : null}

      {selectedJob ? (
        <div className="space-y-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-sky-700">
            <span>Trạng thái:</span>
            <Badge className={statusBadgeTone(selectedJob.status)}>
              {selectedJob.status}
            </Badge>
            <span>| Leads: {selectedJob.leadCount}</span>
            <span>| Processed: {selectedJob.processedCount}</span>
            <span>
              | Retry: {selectedJob.retryCount}/{selectedJob.maxRetry}
            </span>
            <span>| Worker lock: {selectedJob.lockedBy ?? "none"}</span>
            {selectedJob.status === "FAILED" && selectedJob.blockedReason ? (
              <span>| Reason: {selectedJob.blockedReason}</span>
            ) : null}
            {lastUpdatedAgoText ? (
              <span>| Cập nhật: {lastUpdatedAgoText} trước</span>
            ) : null}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-sky-800">
              <span>Tiến trình xử lý</span>
              <span>{jobProgressValue}%</span>
            </div>
            <Progress
              value={visualProgressValue}
              className="h-2.5 bg-sky-100"
            />
            {isJobRunning && estimatedRemainingText ? (
              <p className="text-xs text-sky-700">{estimatedRemainingText}</p>
            ) : null}
          </div>
          <div className="rounded-md border border-sky-500/20 bg-white/50 p-2">
            <p className="text-xs font-medium text-sky-800">Job timeline</p>
            <ul className="mt-1 space-y-1 text-xs text-sky-700">
              <li>Created: {formatTimelineTime(selectedJob.createdAt)}</li>
              <li>Started: {formatTimelineTime(selectedJob.startedAt)}</li>
              <li>
                Last heartbeat:{" "}
                {formatTimelineTime(selectedJob.lastHeartbeatAt)}
              </li>
              <li>Last update: {formatTimelineTime(selectedJob.updatedAt)}</li>
              <li>Finished: {formatTimelineTime(selectedJob.finishedAt)}</li>
              <li>
                Retry scheduled:{" "}
                {formatTimelineTime(selectedJob.retryScheduledFor)}
              </li>
              <li>Lock acquired: {formatTimelineTime(selectedJob.lockedAt)}</li>
              {selectedJob.status === "FAILED" ? (
                <li>Error detail: {selectedJob.errorDetail ?? "N/A"}</li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      {isLikelyStuck ? (
        <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-700">
          <p>
            Job có dấu hiệu bị kẹt (không cập nhật quá 5 phút). Bạn có thể mở
            lại trang Crawlers để kiểm tra log hoặc xóa job này.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/crawlers">Mở My Crawlers</Link>
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setOpenDeleteDialog(true)}
            >
              Xóa job này
            </Button>
          </div>
        </div>
      ) : null}

      {isJobRunning ? (
        <p className="text-sm text-muted-foreground">
          Job đang chạy. Dữ liệu có thể chưa xuất hiện cho tới khi job
          COMPLETED. Trang sẽ tự động làm mới.
        </p>
      ) : null}

      {!jobId ? (
        <p className="text-sm text-muted-foreground">
          Chọn một job từ trang Crawlers để xem posts và reactions.
        </p>
      ) : null}

      {jobId && isLoading ? (
        <p className="text-sm text-muted-foreground">
          Đang tải danh sách posts...
        </p>
      ) : null}

      {jobId && postsError ? (
        <p className="text-sm text-destructive">
          Lỗi tải posts:{" "}
          {postsError instanceof Error ? postsError.message : "Unknown error"}
        </p>
      ) : null}

      {jobId && posts && posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Job này chưa có post nào trong database.
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
              Chưa có data, đang trigger crawl và chờ hoàn tất...
            </p>
          ) : null}

          {reactionError ? (
            <p className="text-sm text-destructive">{reactionError}</p>
          ) : null}

          {!loadingReactions && !reactionError && reactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có reactions sau khi crawl.
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

      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa job đang chạy?</DialogTitle>
            <DialogDescription>
              Job này có thể đang bị kẹt. Xóa job sẽ mất liên kết dữ liệu theo
              jobId hiện tại.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={deletingJob}
              onClick={() => setOpenDeleteDialog(false)}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={deletingJob}
              onClick={() => void handleDeleteJob()}
            >
              {deletingJob ? "Đang xóa..." : "Xóa job"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
