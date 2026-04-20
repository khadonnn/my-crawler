import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import GettingStartedChecklist from "@/components/dashboard/getting-started-checklist";

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
