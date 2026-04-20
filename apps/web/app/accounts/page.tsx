"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CookieImportModal } from "@/components/crawlers/cookie-import-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AccountRow = {
  id: string;
  name: string;
  platform: string;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
};

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "ACTIVE") {
    return "default";
  }

  if (status === "DISABLED") {
    return "secondary";
  }

  return "outline";
}

export default function AccountsPage() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showQuickHelp, setShowQuickHelp] = useState(false);

  const hasData = useMemo(() => rows.length > 0, [rows.length]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/accounts", { cache: "no-store" });
      const result = (await response.json().catch(() => [])) as
        | AccountRow[]
        | { error?: string };

      if (!response.ok) {
        const maybeError = result as { error?: string };
        throw new Error(maybeError.error ?? "Unable to load accounts");
      }

      setRows(result as AccountRow[]);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load data",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function updateStatus(id: string, status: "ACTIVE" | "DISABLED") {
    setBusyId(id);
    setError(null);

    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to update account status");
      }

      await loadAccounts();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update account",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function removeAccount(id: string) {
    setBusyId(id);
    setError(null);

    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
      });

      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to delete account");
      }

      await loadAccounts();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete account",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tài khoản</h1>
        <p className="text-muted-foreground">
          Quản lý cookie session để crawler có thể chạy với tài khoản đã đăng
          nhập.
        </p>
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between ">
          <div className="space-y-1">
            <CardTitle>Quản lý tài khoản</CardTitle>
            <CardDescription>
              Tên, trạng thái và thao tác kích hoạt, vô hiệu hóa hoặc xóa.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowQuickHelp((prev) => !prev)}
              className="gap-2"
            >
              <span className="inline-flex size-2 rounded-full bg-amber-500" />
              Extension lỗi?
            </Button>
            <CookieImportModal onSuccess={loadAccounts} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {showQuickHelp ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Extension ngừng hoạt động? Dùng fallback này:
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-amber-900/90 dark:text-amber-200">
                <li>
                  Mở terminal tại{" "}
                  <span className="font-medium">apps/crawler</span>
                  và chạy{" "}
                  <span className="font-medium">npm run gen-session</span>.
                </li>
                <li>
                  Đăng nhập Facebook trên cửa sổ Playwright, sau đó nhấn Enter
                  để lưu session.
                </li>
                <li>
                  Mở file
                  <span className="font-medium">
                    {" "}
                    apps/crawler/storage/cookies/facebook-session.json
                  </span>
                  , copy toàn bộ JSON và dán vào modal Import Cookie.
                </li>
              </ol>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">
              Đang tải danh sách tài khoản...
            </p>
          ) : null}

          {!loading && !hasData ? (
            <p className="text-sm text-muted-foreground">
              Chưa có tài khoản nào. Bấm Import Cookie để tạo tài khoản đầu
              tiên. Nếu chưa có session, hãy tạo bằng{" "}
              <span className="font-medium">npm run gen-session</span>
              hoặc đăng nhập Facebook trong Playwright rồi sao chép storageState
              JSON.
            </p>
          ) : null}

          {!loading && hasData ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Tên</th>
                    <th className="px-3 py-2 font-medium">Trạng thái</th>
                    <th className="px-3 py-2 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isBusy = busyId === row.id;
                    return (
                      <tr key={row.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium">{row.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.platform} · dùng lần cuối:{" "}
                            {row.lastUsedAt ?? "chưa có"}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={statusVariant(row.status)}
                            className={
                              row.status === "ACTIVE"
                                ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : ""
                            }
                          >
                            {row.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy || row.status === "ACTIVE"}
                              onClick={() =>
                                void updateStatus(row.id, "ACTIVE")
                              }
                            >
                              Kích hoạt
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy || row.status === "DISABLED"}
                              onClick={() =>
                                void updateStatus(row.id, "DISABLED")
                              }
                            >
                              Vô hiệu hóa
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isBusy}
                              onClick={() => void removeAccount(row.id)}
                            >
                              Xóa
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Hướng dẫn import cookie (timeline 3 bước)</CardTitle>
          <CardDescription>
            Cách nhanh nhất cho người dùng phổ thông là dùng extension Get
            cookies.txt LOCALLY.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            <li className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="inline-flex size-6 items-center justify-center rounded-full border border-border text-xs font-semibold">
                  1
                </span>
                <span className="mt-1 h-full min-h-6 w-px bg-border" />
              </div>
              <div>
                <p className="font-medium">
                  Cài extension Get cookies.txt LOCALLY trên Chrome
                </p>
                <p className="text-sm text-muted-foreground">
                  Mở trang Facebook bằng trình duyệt đã đăng nhập tài khoản cần
                  sử dụng cho crawler.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="inline-flex size-6 items-center justify-center rounded-full border border-border text-xs font-semibold">
                  2
                </span>
                <span className="mt-1 h-full min-h-6 w-px bg-border" />
              </div>
              <div>
                <p className="font-medium">Export cookie từ facebook.com</p>
                <p className="text-sm text-muted-foreground">
                  Dùng extension để xuất dữ liệu theo định dạng Netscape HTTP
                  Cookie File.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="inline-flex size-6 items-center justify-center rounded-full border border-border text-xs font-semibold">
                  3
                </span>
              </div>
              <div>
                <p className="font-medium">Dán vào ô Session JSON và import</p>
                <p className="text-sm text-muted-foreground">
                  Copy toàn bộ nội dung cookie và dán vào modal Import Cookie.
                  API sẽ tự động nhận diện Netscape hoặc JSON và chuyển đổi.
                </p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}
