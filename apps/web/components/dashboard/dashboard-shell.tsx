"use client";

import useSWR from "swr";

import { Skeleton } from "@/components/ui/skeleton";

import { GrowthChart } from "./growth-chart";
import { KpiCards } from "./kpi-cards";
import { QualityPie } from "./quality-pie";
import { QuickLaunch } from "./quick-launch";
import { RunningTasks } from "./running-tasks";
import type {
  DashboardPayload,
  ProxyHealthPayload,
  WorkerHealthPayload,
} from "./types";

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export function DashboardShell() {
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
  } = useSWR<DashboardPayload>("/api/dashboard", fetcher, {
    refreshInterval: 10_000,
    revalidateOnFocus: false,
  });

  const { data: workerData } = useSWR<WorkerHealthPayload>(
    "/api/worker-health",
    fetcher,
    {
      refreshInterval: 10_000,
      revalidateOnFocus: false,
    },
  );

  const { data: proxyData } = useSWR<ProxyHealthPayload>(
    "/api/proxy-health",
    fetcher,
    {
      refreshInterval: 10_000,
      revalidateOnFocus: false,
    },
  );

  if (dashboardLoading) {
    return (
      <div className="space-y-4 py-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-4 xl:grid-cols-4">
          <Skeleton className="h-80 rounded-2xl xl:col-span-3" />
          <Skeleton className="h-80 rounded-2xl xl:col-span-1" />
          <Skeleton className="h-80 rounded-2xl xl:col-span-2" />
          <Skeleton className="h-80 rounded-2xl xl:col-span-2" />
        </div>
      </div>
    );
  }

  if (dashboardError || !dashboardData) {
    return (
      <div className="py-6">
        <p className="text-destructive text-sm">
          Khong the tai dashboard. Vui long thu lai sau.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-6">
      <KpiCards
        totalLeads={dashboardData.kpis.totalLeads}
        runningTasks={dashboardData.kpis.runningTasks}
        proxyLiveRate={proxyData?.liveRate ?? 0}
        workerOnline={workerData?.online ?? false}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <GrowthChart data={dashboardData.growth} />
        </div>
        <div className="xl:col-span-1">
          <QualityPie data={dashboardData.quality} />
        </div>
        <div className="xl:col-span-2">
          <RunningTasks data={dashboardData.runningTasks} />
        </div>
        <div className="xl:col-span-2">
          <QuickLaunch />
        </div>
      </div>
    </div>
  );
}
