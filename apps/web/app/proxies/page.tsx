"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImportProxyDialog } from "@/components/proxies/import-proxy-dialog";
import { ProxiesTable } from "@/components/proxies/proxies-table";
import { useState } from "react";

export default function ProxiesPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Proxies / IPs</h1>
        <p className="text-muted-foreground">
          Quản lý proxy pool và kiểm tra tình trạng khả dụng của từng proxy.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Danh Sách Proxy</CardTitle>
            <CardDescription>
              Xem và quản lý toàn bộ proxy trong hệ thống.
            </CardDescription>
          </div>
          <ImportProxyDialog onSuccess={() => setRefreshKey((k) => k + 1)} />
        </CardHeader>
        <CardContent>
          <ProxiesTable key={refreshKey} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hướng Dẫn Sử Dụng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • <strong>Import Proxies:</strong> Nhấn nút Import và dán danh sách
            proxy vào (có thể copy từ file).
          </p>
          <p>
            • <strong>Check Status:</strong> Nhấn nút Refresh để kiểm tra trạng
            thái proxy (Working / Dead / Unknown).
          </p>
          <p>
            • <strong>Region:</strong> Co the dat region khi import proxy
            (VN/US/ANY). Job sẽ ưu tiên proxy đúng region đã chọn.
          </p>
          <p>
            • <strong>Delete:</strong> Nhấn nút Trash để xóa proxy khỏi hệ
            thống.
          </p>
          <p>
            • Proxy sẽ tự động được dùng trong quá trình crawl nếu status là
            WORKING.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
