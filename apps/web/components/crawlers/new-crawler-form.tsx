"use client";

import { FormEvent, useState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";

type NewCrawlerFormProps = {
  onSuccess?: (jobId: string) => void;
  submitLabel?: string;
};

type CreateCrawlerResponse = {
  success?: boolean;
  jobId?: string;
  error?: string;
};

type ProxyData = {
  id: string;
  status: string;
  region?: "ANY" | "VN" | "US";
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
  const [debugMode, setDebugMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasWorkingProxy, setHasWorkingProxy] = useState(false);
  const [proxyCheckLoading, setProxyCheckLoading] = useState(true);

  // Check proxies on mount
  useEffect(() => {
    const checkProxies = async () => {
      try {
        const response = await fetch("/api/proxies");
        if (response.ok) {
          const proxies = (await response.json()) as ProxyData[];
          const hasWorking = proxies.some((p) => p.status === "WORKING");
          setHasWorkingProxy(hasWorking);

          // Set default region based on available proxies
          if (hasWorking) {
            const workingProxies = proxies.filter(
              (p) => p.status === "WORKING",
            );
            const regions = [
              ...new Set(workingProxies.map((p) => p.region ?? "ANY")),
            ];
            // If all working proxies are in same region, use that region
            if (regions.length === 1 && regions[0] !== "ANY") {
              setProxyRegion(regions[0] as "ANY" | "VN" | "US");
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch proxies:", error);
      } finally {
        setProxyCheckLoading(false);
      }
    };

    checkProxies();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasWorkingProxy) {
      toast.error("Khong co proxy WORKING nao. Vui long import proxy truoc.");
      return;
    }

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
          debugMode,
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
      setDebugMode(false);
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
      {proxyCheckLoading ? (
        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>Đang kiểm tra proxy...</span>
        </div>
      ) : !hasWorkingProxy ? (
        <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Không có proxy WORKING nào. Vui lòng import proxy trước khi tạo job.
          </span>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="crawler-url">
          Target URL
        </label>
        <Input
          id="crawler-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.facebook.com/groups/..."
          disabled={loading || !hasWorkingProxy}
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
            disabled={loading || !hasWorkingProxy}
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
            disabled={loading || !hasWorkingProxy}
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
            className="border-input bg-background ring-offset-background w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            value={scrapeMode}
            onChange={(event) =>
              setScrapeMode(
                event.target.value as
                  | "PROFILE_ONLY"
                  | "POST_ONLY"
                  | "PROFILE_AND_POST",
              )
            }
            disabled={loading || !hasWorkingProxy}
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
            className="border-input bg-background ring-offset-background w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            value={proxyRegion}
            onChange={(event) =>
              setProxyRegion(event.target.value as "ANY" | "VN" | "US")
            }
            disabled={loading || !hasWorkingProxy}
          >
            <option value="ANY">Auto / Any region</option>
            <option value="VN">Vietnam</option>
            <option value="US">United States</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Worker se uu tien chon proxy WORKING theo region nay va luu proxy da
            dung vao job history.
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 rounded border disabled:opacity-50"
          checked={debugMode}
          onChange={(event) => setDebugMode(event.target.checked)}
          disabled={loading || !hasWorkingProxy}
        />
        Bat Debug Mode (luu screenshot + raw extract)
      </label>

      <Button
        type="submit"
        disabled={loading || !hasWorkingProxy || proxyCheckLoading}
        className="w-full"
      >
        {proxyCheckLoading
          ? "Kiem tra proxy..."
          : loading
            ? "Dang tao job..."
            : submitLabel}
      </Button>
    </form>
  );
}
