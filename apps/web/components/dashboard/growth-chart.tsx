"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import type { GrowthPoint } from "./types";

const config = {
  value: {
    label: "Du lieu crawl",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function GrowthChart({ data }: { data: GrowthPoint[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Tang Truong Du Lieu</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 12, right: 8, bottom: 4, left: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="4 4" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={42} />
              <Tooltip content={<ChartTooltipContent />} />
              <Line
                dataKey="value"
                stroke="var(--color-chart-2)"
                strokeWidth={2.4}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
