"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Play, Square, Plus, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";

import { NewCrawlerForm } from "@/components/crawlers/new-crawler-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type JobRow = {
  id: string;
  sourceType: string;
  sourceValue: string;
  keyword: string | null;
  requestedProxyRegion: "ANY" | "VN" | "US";
  usedProxyAddress: string | null;
  usedProxyPort: number | null;
  usedProxyRegion: "ANY" | "VN" | "US" | null;
  status: string;
  progress: number;
  leadCount: number;
  processedCount: number;
  blockedReason: string | null;
  retryCount: number;
  maxRetry: number;
  lockedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);

  if (!res.ok) {
    let message = "Request failed";
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Keep default message when body is not JSON.
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
};

function statusTone(status: string) {
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

function blockedReasonTone(reason: string | null) {
  if (!reason) {
    return "bg-zinc-500/20 text-zinc-700";
  }

  if (reason === "LOGIN_WALL" || reason === "CAPTCHA") {
    return "bg-red-500/20 text-red-700";
  }

  if (reason === "TIMEOUT" || reason === "NETWORK_ERROR") {
    return "bg-amber-500/20 text-amber-700";
  }

  return "bg-zinc-500/20 text-zinc-700";
}

function blockedReasonLabel(reason: string | null) {
  if (!reason) {
    return "UNKNOWN";
  }

  if (reason === "LOGIN_WALL" || reason === "CAPTCHA") {
    return reason;
  }

  if (reason === "TIMEOUT" || reason === "NETWORK_ERROR") {
    return reason;
  }

  return reason;
}

function nextActionLabel(job: JobRow): string {
  if (job.status === "FAILED") {
    if (job.blockedReason === "LOGIN_WALL") {
      return "Fix Account/Cookie";
    }

    if (job.blockedReason === "CAPTCHA") {
      return "Change Proxy";
    }

    if (
      job.blockedReason === "TIMEOUT" ||
      job.blockedReason === "NETWORK_ERROR"
    ) {
      return job.retryCount < job.maxRetry ? "Manual Retry" : "Retry Exhausted";
    }

    return "Check Logs";
  }

  if (
    job.status === "PENDING" &&
    (job.blockedReason === "TIMEOUT" || job.blockedReason === "NETWORK_ERROR")
  ) {
    return "Auto-retrying...";
  }

  if (job.status === "RUNNING") {
    return "Monitor";
  }

  if (job.status === "COMPLETED") {
    return "View Data";
  }

  return "-";
}

export function CrawlersConsole() {
  const [openCreate, setOpenCreate] = useState(false);
  const [actingJobId, setActingJobId] = useState<string | null>(null);
  const [deleteTargetJobId, setDeleteTargetJobId] = useState<string | null>(
    null,
  );

  const {
    data: jobs,
    isLoading,
    error,
    mutate,
  } = useSWR<JobRow[]>("/api/jobs", fetcher, {
    refreshInterval: 10_000,
    revalidateOnFocus: false,
  });

  async function handleRerun(jobId: string) {
    setActingJobId(jobId);

    try {
      const response = await fetch(`/api/jobs/${jobId}/rerun`, {
        method: "POST",
      });

      const payload = (await response.json()) as {
        error?: string;
        jobId?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Không thể chạy lại job");
      }

      toast.success(`Đã tạo lại job mới: ${payload.jobId ?? "N/A"}`);
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chạy lại thất bại");
    } finally {
      setActingJobId(null);
    }
  }

  async function handleStop(jobId: string) {
    setActingJobId(jobId);

    try {
      const response = await fetch(`/api/jobs/${jobId}/stop`, {
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Không thể dừng job");
      }

      toast.success("Đã dừng job thành công");
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dừng thất bại");
    } finally {
      setActingJobId(null);
    }
  }

  async function handleDelete(jobId: string) {
    setActingJobId(jobId);

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

      toast.success("Đã xóa job thành công");
      setDeleteTargetJobId(null);
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xóa job thất bại");
    } finally {
      setActingJobId(null);
    }
  }

  async function handleRetry(jobId: string) {
    setActingJobId(jobId);

    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: "POST",
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Không thể retry job");
      }

      toast.success("Đã đưa job vào hàng đợi retry");
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry thất bại");
    } finally {
      setActingJobId(null);
    }
  }

  return (
    <section className="space-y-6 py-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">My Crawlers</h1>
          <p className="text-muted-foreground max-w-2xl">
            Quản lý toàn bộ job crawl đã tạo, theo dõi kết quả, và điều phối lại
            các job lớn trên hệ thống phân tán.
          </p>
        </div>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 size-4" />
              New Crawler
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Advanced Create</DialogTitle>
              <DialogDescription>
                Tạo crawler job với keywords, scope profile/post, proxy region,
                và lịch trình chạy.
              </DialogDescription>
            </DialogHeader>
            <NewCrawlerForm
              submitLabel="Create and Dispatch"
              onSuccess={() => {
                setOpenCreate(false);
                mutate();
              }}
            />
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(deleteTargetJobId)}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTargetJobId(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Xóa job?</DialogTitle>
              <DialogDescription>
                Bạn có chắc muốn xóa Job này? Dữ liệu liên quan có thể sẽ bị
                mất.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteTargetJobId(null);
                  toast.info("Đã hủy thao tác xóa job");
                }}
                disabled={Boolean(actingJobId)}
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (deleteTargetJobId) {
                    void handleDelete(deleteTargetJobId);
                  }
                }}
                disabled={Boolean(actingJobId)}
              >
                Xóa job
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job History</CardTitle>
          <CardDescription>
            Danh sách toàn bộ lượt crawl: ID, URL, ngày chạy, số leads, trạng
            thái và hành động vận hành.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          {!isLoading && error ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-destructive">
                Lỗi tại lịch sử jobs:{" "}
                {String(
                  error instanceof Error ? error.message : "Unknown error",
                )}
              </p>
              <Button size="sm" variant="outline" onClick={() => mutate()}>
                Thử lại
              </Button>
            </div>
          ) : null}

          {!isLoading && !error && jobs?.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Chưa có crawler job nào. Bấm New Crawler để tạo job đầu tiên.
            </p>
          ) : null}

          {!isLoading && !error && jobs && jobs.length > 0 ? (
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium">
                        Job ID
                      </th>
                      <th className="px-2 py-2 text-left font-medium">URL</th>
                      <th className="px-2 py-2 text-left font-medium">Proxy</th>
                      <th className="px-2 py-2 text-left font-medium">
                        Ngày chạy
                      </th>
                      <th className="px-2 py-2 text-left font-medium">Leads</th>
                      <th className="px-2 py-2 text-left font-medium">
                        Status
                      </th>
                      <th className="px-2 py-2 text-left font-medium">
                        Next Action
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {jobs.map((job) => {
                      const isActing = actingJobId === job.id;
                      const canStop =
                        job.status === "RUNNING" || job.status === "PENDING";
                      const canDelete =
                        job.status === "RUNNING" || job.status === "PENDING";
                      const canRetry =
                        job.status === "FAILED" &&
                        job.retryCount < job.maxRetry;

                      return (
                        <tr key={job.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-xs">
                            {job.id.slice(0, 8)}...
                          </td>
                          <td className="px-4 py-3">
                            <div className="max-w-sm space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate font-medium text-sm">
                                  {job.sourceValue}
                                </p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 flex-shrink-0"
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      job.sourceValue,
                                    );
                                    toast.success("Đã copy URL");
                                  }}
                                  title="Copy URL"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              {job.keyword ? (
                                <p className="text-muted-foreground text-xs">
                                  Keyword: {job.keyword}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div className="space-y-1">
                              <p className="font-medium">
                                Requested: {job.requestedProxyRegion}
                              </p>
                              <p className="text-muted-foreground">
                                Used:{" "}
                                {job.usedProxyAddress && job.usedProxyPort
                                  ? `${job.usedProxyAddress}:${job.usedProxyPort} (${job.usedProxyRegion ?? "ANY"})`
                                  : "Auto / none selected"}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat("vi-VN", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(job.createdAt))}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {job.leadCount}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <Badge className={statusTone(job.status)}>
                                {job.status}
                              </Badge>
                              {job.status === "FAILED" ? (
                                <Badge
                                  variant="outline"
                                  className={blockedReasonTone(
                                    job.blockedReason,
                                  )}
                                >
                                  {blockedReasonLabel(job.blockedReason)}
                                </Badge>
                              ) : null}
                              <p className="text-[11px] text-muted-foreground">
                                Retry: {job.retryCount}/{job.maxRetry}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                Lock: {job.lockedBy ?? "none"}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {nextActionLabel(job)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isActing}
                                onClick={() => handleRerun(job.id)}
                              >
                                <Play className="mr-1 size-3.5" />
                                Rerun
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={isActing || !canRetry}
                                onClick={() => void handleRetry(job.id)}
                              >
                                Retry
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isActing || !canStop}
                                onClick={() => handleStop(job.id)}
                              >
                                <Square className="mr-1 size-3.5" />
                                Stop
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={isActing || !canDelete}
                                onClick={() => setDeleteTargetJobId(job.id)}
                              >
                                <Trash2 className="mr-1 size-3.5" />
                                Delete
                              </Button>
                              <Button size="sm" variant="secondary" asChild>
                                <Link href={`/datasets?jobId=${job.id}`}>
                                  View Data
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
