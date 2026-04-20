"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CookieImportModalProps = {
  onSuccess?: () => void;
};

export function CookieImportModal({ onSuccess }: CookieImportModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sessionJson, setSessionJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Tên là bắt buộc.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          platform: "facebook",
          sessionData: sessionJson,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setError(result.error ?? "Không thể import session tài khoản.");
        return;
      }

      setName("");
      setSessionJson("");
      setOpen(false);
      onSuccess?.();
    } catch {
      setError("Lỗi mạng khi import cookie session.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Import Cookie</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import cookie session</DialogTitle>
          <DialogDescription>
            Dán JSON Array, Netscape text hoặc Header String từ extension
            <span className="font-medium"> Get cookies.txt LOCALLY</span>). Hệ
            thống sẽ tự nhận diện và chuyển đổi để lưu tài khoản.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium">Tên</label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tên tài khoản"
              disabled={loading}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Nội dung cookie</label>
            <Textarea
              value={sessionJson}
              onChange={(event) => setSessionJson(event.target.value)}
              placeholder='[{"domain":".facebook.com","name":"c_user","value":"..."}]'
              className="min-h-44"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Hỗ trợ 3 định dạng: JSON Array, Netscape HTTP Cookie File hoặc
              Header String.
            </p>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang import..." : "Lưu session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
