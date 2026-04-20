"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Play, Square, Plus } from "lucide-react";
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

export function CrawlersConsole() {
  const [openCreate, setOpenCreate] = useState(false);
  const [actingJobId, setActingJobId] = useState<string | null>(null);

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
        throw new Error(payload.error ?? "Khong the chay lai job");
      }

      toast.success(`Da tao lai job moi: ${payload.jobId ?? "N/A"}`);
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rerun that bai");
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
        throw new Error(payload.error ?? "Khong the dung job");
      }

      toast.success("Da dung job thanh cong");
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Stop that bai");
    } finally {
      setActingJobId(null);
    }
  }

  return (
    <section className="space-y-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Crawlers</h1>
          <p className="text-muted-foreground max-w-2xl">
            Quan ly toan bo job crawl da tao, theo doi ket qua, va dieu phoi lai
            cac job lon tren he thong phan tan.
          </p>
        </div>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              New Crawler
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Advanced Create</DialogTitle>
              <DialogDescription>
                Tao crawler job voi keywords, scope profile/post, proxy region,
                va lich trinh chay.
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job History</CardTitle>
          <CardDescription>
            Danh sach toan bo luot crawl: ID, URL, ngay chay, so leads, trang
            thai va hanh dong van hanh.
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
                Loi tai lich su jobs:{" "}
                {String(
                  error instanceof Error ? error.message : "Unknown error",
                )}
              </p>
              <Button size="sm" variant="outline" onClick={() => mutate()}>
                Thu lai
              </Button>
            </div>
          ) : null}

          {!isLoading && !error && jobs?.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Chua co crawler job nao. Bam New Crawler de tao job dau tien.
            </p>
          ) : null}

          {!isLoading && !error && jobs && jobs.length > 0 ? (
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">
                        Job ID
                      </th>
                      <th className="px-4 py-3 text-left font-medium">URL</th>
                      <th className="px-4 py-3 text-left font-medium">Proxy</th>
                      <th className="px-4 py-3 text-left font-medium">
                        Ngay chay
                      </th>
                      <th className="px-4 py-3 text-left font-medium">Leads</th>
                      <th className="px-4 py-3 text-left font-medium">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {jobs.map((job) => {
                      const isActing = actingJobId === job.id;
                      const canStop =
                        job.status === "RUNNING" || job.status === "PENDING";

                      return (
                        <tr key={job.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-xs">
                            {job.id.slice(0, 8)}...
                          </td>
                          <td className="px-4 py-3">
                            <div className="max-w-xs space-y-1">
                              <p className="truncate font-medium">
                                {job.sourceValue}
                              </p>
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
                            <Badge className={statusTone(job.status)}>
                              {job.status}
                            </Badge>
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
                                variant="ghost"
                                disabled={isActing || !canStop}
                                onClick={() => handleStop(job.id)}
                              >
                                <Square className="mr-1 size-3.5" />
                                Stop
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
