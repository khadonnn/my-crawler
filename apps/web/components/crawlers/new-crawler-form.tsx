"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type NewCrawlerFormProps = {
  onSuccess?: (jobId: string) => void;
  submitLabel?: string;
};

type CreateCrawlerResponse = {
  success?: boolean;
  jobId?: string;
  error?: string;
};

export function NewCrawlerForm({
  onSuccess,
  submitLabel = "Create Crawler Job",
}: NewCrawlerFormProps) {
  const [url, setUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [scrapeMode, setScrapeMode] = useState<
    "PROFILE_ONLY" | "POST_ONLY" | "PROFILE_AND_POST"
  >("PROFILE_AND_POST");
  const [proxyRegion, setProxyRegion] = useState<"ANY" | "VN" | "US">("ANY");
  const [schedule, setSchedule] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!url.trim()) {
      toast.error("Vui long nhap URL can crawl");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url.trim(),
          keyword: keyword.trim() || undefined,
          scrapeMode,
          proxyRegion,
          schedule: schedule.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as CreateCrawlerResponse;

      if (!response.ok || !payload.jobId) {
        throw new Error(payload.error ?? "Khong the tao crawler job");
      }

      toast.success(`Da tao job thanh cong: ${payload.jobId}`);
      setUrl("");
      setKeyword("");
      setScrapeMode("PROFILE_AND_POST");
      setProxyRegion("ANY");
      setSchedule("");
      onSuccess?.(payload.jobId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Khong the ket noi worker",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="crawler-url">
          Target URL
        </label>
        <Input
          id="crawler-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.facebook.com/groups/..."
          disabled={loading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="crawler-keyword">
            Keywords (optional)
          </label>
          <Input
            id="crawler-keyword"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="du lich, bat dong san, tuyen dung"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="crawler-schedule">
            Schedule (optional)
          </label>
          <Input
            id="crawler-schedule"
            value={schedule}
            onChange={(event) => setSchedule(event.target.value)}
            placeholder="0 */4 * * *"
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="crawler-scope">
            Crawl Scope
          </label>
          <select
            id="crawler-scope"
            className="border-input bg-background ring-offset-background w-full rounded-md border px-3 py-2 text-sm"
            value={scrapeMode}
            onChange={(event) =>
              setScrapeMode(
                event.target.value as
                  | "PROFILE_ONLY"
                  | "POST_ONLY"
                  | "PROFILE_AND_POST",
              )
            }
            disabled={loading}
          >
            <option value="PROFILE_AND_POST">Profile + Post</option>
            <option value="PROFILE_ONLY">Profile only</option>
            <option value="POST_ONLY">Post only</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="crawler-proxy-region">
            Proxy Region
          </label>
          <select
            id="crawler-proxy-region"
            className="border-input bg-background ring-offset-background w-full rounded-md border px-3 py-2 text-sm"
            value={proxyRegion}
            onChange={(event) =>
              setProxyRegion(event.target.value as "ANY" | "VN" | "US")
            }
            disabled={loading}
          >
            <option value="ANY">Auto / Any region</option>
            <option value="VN">Vietnam</option>
            <option value="US">United States</option>
          </select>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Dang tao job..." : submitLabel}
      </Button>
    </form>
  );
}
