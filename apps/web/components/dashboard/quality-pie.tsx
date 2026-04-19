"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import type { QualityPoint } from "./types";

const COLORS = ["var(--color-chart-3)", "var(--color-chart-5)"];

const config = {
  Potential: { label: "Potential", color: "hsl(var(--chart-3))" },
  Neutral: { label: "Neutral", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

export function QualityPie({ data }: { data: QualityPoint[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Lead Quality</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-55">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={82}
                paddingAngle={4}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="mt-3 grid gap-1 text-sm">
          {data.map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
