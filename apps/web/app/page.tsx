import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import GettingStartedChecklist from "@/components/dashboard/getting-started-checklist";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <section className="space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Trung tâm điều hành Dashboard
        </h1>
        <p className="text-muted-foreground text-sm">
          Theo dõi sức khoẻ hệ thống, chất lượng lead và tiến độ crawl theo thời
          gian thực.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Bước 1/5: Trang chủ</p>
            <p className="text-sm text-muted-foreground">
              Bắt đầu từ đây, rồi sang bước proxy để tránh crawl trực tiếp bằng
              IP thật.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/proxies">Đi tới bước Proxy</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <GettingStartedChecklist />
      </div>

      <div className="pt-2">
        <div className="mb-4 flex items-end justify-between gap-3 border-t border-border/60 pt-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Chỉ số trực tiếp
            </h2>
            <p className="text-muted-foreground text-sm">
              Phần bên dưới là trạng thái hệ thống, task đang chạy và biểu đồ
              theo dõi.
            </p>
          </div>
        </div>
        <DashboardShell />
      </div>
    </section>
  );
}
