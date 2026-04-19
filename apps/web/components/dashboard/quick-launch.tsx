"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function QuickLaunch() {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!url.trim()) {
      setMessage("Vui long nhap URL can crawl");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/jobs/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Khong the tao task crawl");
      }

      setMessage(`Da tao task thanh cong. Job ID: ${payload.jobId}`);
      setUrl("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Khong the ket noi worker",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Quick Launch</CardTitle>
        <CardDescription>
          Dan URL Facebook Group de kich hoat crawl ngay.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={onSubmit}>
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.facebook.com/groups/..."
            disabled={loading}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Dang gui..." : "Start Instant Scrape"}
          </Button>
        </form>
        {message ? (
          <p className="text-muted-foreground mt-3 text-xs">{message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
