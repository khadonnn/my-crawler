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
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-muted-foreground">
          Quan ly cookie sessions de crawler co the chay voi tai khoan da dang
          nhap.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Account Management</CardTitle>
            <CardDescription>
              Name, status, va thao tac kich hoat/vo hieu hoa/xoa account.
            </CardDescription>
          </div>
          <CookieImportModal onSuccess={loadAccounts} />
        </CardHeader>

        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading accounts...</p>
          ) : null}

          {!loading && !hasData ? (
            <p className="text-sm text-muted-foreground">
              Chua co account nao. Bam Import Cookie de tao account dau tien.
            </p>
          ) : null}

          {!loading && hasData ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
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
                            {row.platform} · last used:{" "}
                            {row.lastUsedAt ?? "never"}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={statusVariant(row.status)}>
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
                              Activate
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy || row.status === "DISABLED"}
                              onClick={() =>
                                void updateStatus(row.id, "DISABLED")
                              }
                            >
                              Disable
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isBusy}
                              onClick={() => void removeAccount(row.id)}
                            >
                              Delete
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
    </section>
  );
}
