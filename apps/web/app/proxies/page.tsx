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
          Quan ly proxy pool va kiem tra tinh trang kha dung cua tung proxy.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Danh Sach Proxy</CardTitle>
            <CardDescription>
              Xem va quan ly toan bo proxy trong he thong.
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
          <CardTitle>Huong Dan Su Dung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • <strong>Import Proxies:</strong> Nhan nut Import va dan danh sach
            proxy vao (co the copy tu file).
          </p>
          <p>
            • <strong>Check Status:</strong> Nhan nut Refresh de kiem tra trang
            thai proxy (Working / Dead / Unknown).
          </p>
          <p>
            • <strong>Delete:</strong> Nhan nut Trash de xoa proxy khoi he
            thong.
          </p>
          <p>
            • Proxy se tu dong duoc dung trong qua trinh crao neu status la
            WORKING.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
