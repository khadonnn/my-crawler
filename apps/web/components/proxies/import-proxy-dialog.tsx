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
      toast.error("Vui long nhap danh sach proxy");
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
        throw new Error(data?.error || "Import that bai");
      }

      if (data.imported > 0) {
        toast.success(`Nhap thanh cong ${data.imported} proxy`);
      } else {
        toast("Khong co proxy moi de import");
      }

      if (data.failed > 0) {
        toast(`${data.failed} dong khong hop le hoac bi trung`);
      }

      setText("");
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import that bai");
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
