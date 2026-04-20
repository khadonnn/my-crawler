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
      setError("Name is required.");
      return;
    }

    try {
      JSON.parse(sessionJson);
    } catch {
      setError("Session JSON is invalid.");
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
        setError(result.error ?? "Unable to import account session.");
        return;
      }

      setName("");
      setSessionJson("");
      setOpen(false);
      onSuccess?.();
    } catch {
      setError("Network error while importing cookie session.");
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
          <DialogTitle>Import Cookie Session</DialogTitle>
          <DialogDescription>
            Paste Playwright storageState JSON for a Facebook account.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Account name"
              disabled={loading}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Session JSON</label>
            <Textarea
              value={sessionJson}
              onChange={(event) => setSessionJson(event.target.value)}
              placeholder='{"cookies":[],"origins":[]}'
              className="min-h-44"
              disabled={loading}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Importing..." : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
