import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import type { RunningTask } from "./types";

export function RunningTasks({ data }: { data: RunningTask[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Running Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Khong co task nao dang chay.
          </p>
        ) : (
          <ul className="space-y-4">
            {data.map((task) => (
              <li key={task.id} className="space-y-2 rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{task.sourceValue}</p>
                    <p className="text-muted-foreground text-xs">
                      {task.sourceType} ·{" "}
                      {new Intl.DateTimeFormat("vi-VN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(task.createdAt))}
                    </p>
                  </div>
                  <Badge variant="secondary">{task.status}</Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{task.progress}%</span>
                  </div>
                  <Progress value={task.progress} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
