import { Activity, Bot, Gauge, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KPIProps = {
  totalLeads: number;
  runningTasks: number;
  proxyLiveRate: number;
  workerOnline: boolean;
};

const items = [
  {
    key: "leads",
    label: "Tong Leads",
    icon: Activity,
    color: "text-blue-600",
  },
  {
    key: "running",
    label: "Task Dang Chay",
    icon: Bot,
    color: "text-amber-600",
  },
  {
    key: "proxy",
    label: "Proxy Song",
    icon: ShieldCheck,
    color: "text-emerald-600",
  },
  {
    key: "worker",
    label: "Worker Health",
    icon: Gauge,
    color: "text-rose-600",
  },
] as const;

export function KpiCards({
  totalLeads,
  runningTasks,
  proxyLiveRate,
  workerOnline,
}: KPIProps) {
  const values = {
    leads: `${totalLeads}`,
    running: `${runningTasks}`,
    proxy: `${proxyLiveRate}%`,
    worker: workerOnline ? "Online" : "Offline",
  } as const;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Card key={item.key} className="relative overflow-hidden">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {item.label}
              </CardTitle>
              <Icon className={cn("size-4", item.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{values[item.key]}</div>
              {item.key === "worker" ? (
                <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "inline-block size-2 rounded-full",
                      workerOnline
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-rose-500",
                    )}
                  />
                  {workerOnline
                    ? "Cong worker dang san sang"
                    : "Worker chua hoat dong"}
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
