"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

interface Proxy {
  id: string;
  address: string;
  port: number;
  region?: "ANY" | "VN" | "US";
  status: string;
  latency: number;
  createdAt: string;
}

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    let message = "Failed to fetch";
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

export function ProxiesTable() {
  const {
    data: proxies,
    isLoading,
    error,
    mutate,
  } = useSWR<Proxy[]>("/api/proxies", fetcher, {
    refreshInterval: 5000,
  });

  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());

  async function handleDelete(id: string) {
    if (!confirm("Xac nhan xoa proxy nay?")) return;

    try {
      await fetch(`/api/proxies`, {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      mutate();
    } catch {
      alert("Loi xoa proxy");
    }
  }

  async function handleCheck(id: string) {
    const newSet = new Set(checkingIds);
    newSet.add(id);
    setCheckingIds(newSet);

    try {
      await fetch("/api/proxies/check-health", {
        method: "POST",
        body: JSON.stringify({ proxyIds: [id] }),
      });
      mutate();
    } catch {
      alert("Loi kiem tra proxy");
    } finally {
      newSet.delete(id);
      setCheckingIds(newSet);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6 text-center">
          <p className="text-sm text-destructive">
            Loi tai du lieu proxy:{" "}
            {String(error instanceof Error ? error.message : "Unknown error")}
          </p>
          <Button size="sm" variant="outline" onClick={() => mutate()}>
            Thu lai
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!proxies || proxies.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center text-sm">
            Khong co proxy nao. Hay them proxy bang cach nhap danh sach.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Address</th>
              <th className="px-4 py-3 text-left font-medium">Port</th>
              <th className="px-4 py-3 text-left font-medium">Region</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Latency</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {proxies.map((proxy) => {
              const isChecking = checkingIds.has(proxy.id);
              const statusColor =
                proxy.status === "WORKING"
                  ? "bg-emerald-500/20 text-emerald-700"
                  : proxy.status === "DEAD"
                    ? "bg-red-500/20 text-red-700"
                    : "bg-gray-500/20 text-gray-700";
              const Icon = proxy.status === "WORKING" ? CheckCircle : XCircle;

              return (
                <tr key={proxy.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    {proxy.address}
                  </td>
                  <td className="px-4 py-3 font-mono">{proxy.port}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{proxy.region ?? "ANY"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusColor}>
                      <Icon className="mr-1 size-3" />
                      {proxy.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {proxy.latency}ms
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("vi-VN", {
                      dateStyle: "short",
                    }).format(new Date(proxy.createdAt))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCheck(proxy.id)}
                        disabled={isChecking}
                      >
                        <RefreshCw className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(proxy.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
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
  );
}
