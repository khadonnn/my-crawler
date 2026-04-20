import Link from "next/link";

import { getPrisma } from "@scraping-platform/db";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Database,
  ShieldCheck,
  Sparkles,
  Play,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type ChecklistStep = {
  title: string;
  description: string;
  href: string;
  icon: typeof ShieldCheck;
  done: boolean;
};

export default async function GettingStartedChecklist() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

  let activeAccountCount = 0;
  let jobCount = 0;
  let completedJobCount = 0;
  let interactionCount = 0;

  if (hasDatabaseUrl) {
    const prisma = getPrisma();

    [activeAccountCount, jobCount, completedJobCount, interactionCount] =
      await Promise.all([
        prisma.account.count({ where: { status: "ACTIVE" } }),
        prisma.job.count(),
        prisma.job.count({ where: { status: "COMPLETED" } }),
        prisma.interaction.count(),
      ]);
  }

  const steps: ChecklistStep[] = [
    {
      title: "Cấp quyền truy cập",
      description:
        "Nạp session hoặc cookie để crawler có thể vào Facebook an toàn và đúng vai trò.",
      href: "/accounts",
      icon: ShieldCheck,
      done: activeAccountCount > 0,
    },
    {
      title: "Tạo crawler",
      description:
        "Chọn URL, keyword và phạm vi crawl để khởi động một job mới.",
      href: "/crawlers/new",
      icon: Target,
      done: jobCount > 0,
    },
    {
      title: "Chạy thu thập dữ liệu",
      description: "Kích hoạt một job mới và đợi đến khi crawler hoàn thành.",
      href: "/crawlers",
      icon: Play,
      done: completedJobCount > 0,
    },
    {
      title: "Xem dữ liệu",
      description:
        "Mở datasets để xem post, reaction, comment và lead đã crawl được.",
      href: "/datasets",
      icon: Database,
      done: interactionCount > 0,
    },
  ];

  const completedSteps = steps.filter((step) => step.done).length;
  const progress = Math.round((completedSteps / steps.length) * 100);

  return (
    <Card className="overflow-hidden border-border/60 bg-linear-to-br from-background via-background to-muted/20 shadow-sm">
      <CardHeader className="space-y-4 border-b border-border/60 bg-background/70">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5" />
              Bắt đầu nhanh
            </div>
            <CardTitle className="text-xl">Checklist bắt đầu</CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-6">
              Làm theo 4 bước này để đi từ trạng thái chưa biết bắt đầu ở đâu
              sang một flow scraping rõ ràng, có trạng thái và có dữ liệu thật.
            </CardDescription>
            {!hasDatabaseUrl ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                DATABASE_URL chưa được cấu hình trong môi trường dev, nên
                checklist đang hiển thị trạng thái chờ cho đến khi kết nối DB.
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-left shadow-sm md:min-w-52">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Hoàn thành
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {completedSteps}/4
                </p>
              </div>
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <CheckCircle2 className="size-5" />
              </div>
            </div>
            <Progress value={progress} className="mt-3 h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {progress}% luồng scraping đã sẵn sàng.
            </p>
          </div>
        </div>
      </CardHeader>

      <div className="mx-4 border-t border-border/60" />

      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const badgeClassName = step.done
            ? ""
            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";

          return (
            <div
              key={step.title}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-colors duration-200 hover:shadow-md"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary/80 via-primary/40 to-transparent" />
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-transparent via-transparent to-primary/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              <div className="pointer-events-none absolute bottom-0 right-0 h-24 w-24 translate-x-6 translate-y-6 rounded-full bg-radial-[at_70%_70%] from-primary/20 via-primary/10 to-transparent opacity-0 blur-2xl transition-opacity duration-200 group-hover:opacity-100" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`rounded-xl p-2 ${step.done ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Bước {index + 1}
                      </span>
                      <Badge
                        variant={step.done ? "default" : "secondary"}
                        className={
                          step.done
                            ? ""
                            : "border-border/60 bg-muted text-muted-foreground"
                        }
                      >
                        {step.done ? "Hoàn thành" : "Cần thực hiện"}
                      </Badge>
                    </div>
                    <h3 className="font-semibold leading-tight">
                      {step.title}
                    </h3>
                  </div>
                </div>
                {step.done ? (
                  <CheckCircle2 className="mt-1 size-5 shrink-0 text-emerald-600" />
                ) : (
                  <CircleDashed className="mt-1 size-5 shrink-0 text-amber-500" />
                )}
              </div>

              <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">
                {step.description}
              </p>

              <div className="mt-4 flex items-center justify-between gap-3">
                <Button
                  asChild
                  variant={step.done ? "outline" : "default"}
                  size="sm"
                >
                  <Link href={step.href}>
                    <span>Mở {step.title}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
