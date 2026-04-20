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
import { toast } from "sonner";

export function ImportProxyDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  type BulkImportResponse = {
    imported: number;
    failed: number;
    error?: string;
  };

  async function handleImport() {
    if (!text.trim()) {
      toast.error("Vui lòng nhập danh sách proxy");
      return;
    }

    setLoading(true);
    const proxyList = text
      .split(/[\r\n;]+/g)
      .map((line) => line.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/proxies/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxyList }),
      });

      const data = (await res.json()) as BulkImportResponse;
      if (!res.ok) {
        throw new Error(data?.error || "Import thất bại");
      }

      if (data.imported > 0) {
        toast.success(`Nhập thành công ${data.imported} proxy`);
      } else {
        toast("Không có proxy mới để import");
      }

      if (data.failed > 0) {
        toast(`${data.failed} dòng không hợp lệ hoặc bị trùng`);
      }

      setText("");
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Plus className="mr-2 size-4" />
          Import Proxy
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nhập Danh Sách Proxy</DialogTitle>
          <DialogDescription>
            Định dạng: ip:port, ip:port:user:pass, hoặc thêm region ở cuối dòng
            (VN/US/ANY). Ví dụ: ip:port:user:pass:VN
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
          <div className="flex gap-2">
            <Button
              onClick={handleImport}
              disabled={loading || !text.trim()}
              className="flex-1"
            >
              {loading ? "Đang nhập..." : "Import"}
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
              }}
              variant="outline"
            >
              Đóng
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
