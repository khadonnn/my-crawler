import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function Home() {
  return (
    <section className="space-y-2 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Dashboard Command Center
        </h1>
        <p className="text-muted-foreground text-sm">
          Theo doi suc khoe he thong, chat luong lead va tien do crawl theo thoi
          gian thuc.
        </p>
      </div>
      <DashboardShell />
    </section>
  );
}
