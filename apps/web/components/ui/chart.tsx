"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label: string; color: string }>;

type ChartTooltipContentProps = {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    value?: number;
  }>;
};

const ChartContext = React.createContext<ChartConfig | null>(null);

function useChartConfig() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("Chart components must be wrapped in ChartContainer");
  }

  return context;
}

function ChartContainer({
  config,
  className,
  children,
}: {
  config: ChartConfig;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ChartContext.Provider value={config}>
      <div className={cn("h-70 w-full", className)}>{children}</div>
    </ChartContext.Provider>
  );
}

function ChartTooltipContent({
  active,
  payload,
}: ChartTooltipContentProps) {
  const config = useChartConfig();

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="bg-background/95 border-border min-w-40 rounded-lg border p-2 text-xs shadow-lg backdrop-blur">
      {payload.map((item) => {
        if (!item.dataKey) {
          return null;
        }

        const key = String(item.dataKey);
        const conf = config[key];

        return (
          <div
            key={key}
            className="flex items-center justify-between gap-2 py-0.5"
          >
            <span className="text-muted-foreground">{conf?.label ?? key}</span>
            <span className="font-semibold" style={{ color: conf?.color }}>
              {item.value ?? 0}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export { ChartContainer, ChartTooltipContent };
