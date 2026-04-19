"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useState } from "react";

interface BulkImportResult {
  imported: number;
  failed: number;
  results: unknown[];
  errors: Record<string, string>[];
}

export function ImportProxyDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  async function handleImport() {
    if (!text.trim()) {
      alert("Vui long nhap danh sach proxy");
      return;
    }

    setLoading(true);
    const proxyList = text
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    try {
      const res = await fetch("/api/proxies/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxyList }),
      });

      const data = await res.json();
      setResult(data);

      if (data.imported > 0) {
        setText("");
        setTimeout(() => {
          setOpen(false);
          setResult(null);
          onSuccess?.();
        }, 1500);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Import that bai");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Plus className="mr-2 size-4" />
          Import Proxies
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nhap Danh Sach Proxy</DialogTitle>
          <DialogDescription>
            Dinh dang: ip:port:user:pass (moi dong mot proxy, user/pass la tuy
            chon)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            placeholder="192.168.1.1:8080&#10;192.168.1.2:8080:admin:pass123&#10;..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-32"
            disabled={loading}
          />
          {result ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
              <p className="font-medium">
                ✓ Nhap thanh cong: {result.imported} proxy
              </p>
              {result.failed > 0 && (
                <p className="text-xs text-orange-600">
                  Loi: {result.failed} proxy
                </p>
              )}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button
              onClick={handleImport}
              disabled={loading || !text.trim()}
              className="flex-1"
            >
              {loading ? "Dang nhap..." : "Import"}
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                setResult(null);
              }}
              variant="outline"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
