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

type CrawlStrategy = "FACEBOOK_DIRECT" | "FACEBOOK_SEARCH";
type CrawlMode = "DIRECT_URL" | "SEARCH_KEYWORD";

type CreateCrawlerResponse = {
  success?: boolean;
  jobId?: string;
  error?: string;
};

type ProxyData = {
  id: string;
  address: string;
  port: number;
  status: string;
  countryCode?: string;
  region?: "ANY" | "VN" | "US";
};

type ProxyCountryStat = {
  countryCode: string;
  count: number;
};

function normalizeCountryCode(value: unknown) {
  if (typeof value !== "string") {
    return "UNKNOWN";
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : "UNKNOWN";
}

function getCountryFlag(countryCode: string) {
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return "🌐";
  }

  const chars = [...countryCode].map((char) =>
    String.fromCodePoint(127397 + char.charCodeAt(0)),
  );

  return chars.join("");
}

export function NewCrawlerForm({
  onSuccess,
  submitLabel = "Create Crawler Job",
}: NewCrawlerFormProps) {
  const [mode, setMode] = useState<CrawlMode>("DIRECT_URL");
  const [url, setUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [scrapeMode, setScrapeMode] = useState<
    "PROFILE_ONLY" | "POST_ONLY" | "PROFILE_AND_POST"
  >("PROFILE_AND_POST");
  const [targetCountry, setTargetCountry] = useState("AUTO");
  const [selectedProxyId, setSelectedProxyId] = useState("");
  const [workingProxies, setWorkingProxies] = useState<ProxyData[]>([]);
  const [countryStats, setCountryStats] = useState<ProxyCountryStat[]>([]);
  const [schedule, setSchedule] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasWorkingProxy, setHasWorkingProxy] = useState(false);
  const [proxyCheckLoading, setProxyCheckLoading] = useState(true);

  const isDirectMode = mode === "DIRECT_URL";
  const strategy: CrawlStrategy = isDirectMode
    ? "FACEBOOK_DIRECT"
    : "FACEBOOK_SEARCH";

  // Check proxies on mount
  useEffect(() => {
    const checkProxies = async () => {
      try {
        const [proxiesResponse, statsResponse] = await Promise.all([
          fetch("/api/proxies"),
          fetch("/api/proxies/stats"),
        ]);

        if (!proxiesResponse.ok) {
          throw new Error("Failed to fetch proxies");
        }

        const proxies = (await proxiesResponse.json()) as ProxyData[];
        const hasWorking = proxies.some((p) => p.status === "WORKING");
        const onlyWorking = proxies.filter((p) => p.status === "WORKING");
        setWorkingProxies(onlyWorking);
        setHasWorkingProxy(hasWorking);

        if (
          selectedProxyId &&
          !onlyWorking.some((proxy) => proxy.id === selectedProxyId)
        ) {
          setSelectedProxyId("");
        }

        if (statsResponse.ok) {
          const statsPayload = (await statsResponse.json()) as {
            countries?: Array<{ countryCode: string; count: number }>;
          };

          const normalizedStats = (statsPayload.countries ?? [])
            .map((row) => ({
              countryCode: normalizeCountryCode(row.countryCode),
              count: row.count,
            }))
            .filter((row) => row.count > 0)
            .sort((a, b) => b.count - a.count);

          setCountryStats(normalizedStats);

          if (
            targetCountry !== "AUTO" &&
            !normalizedStats.some((row) => row.countryCode === targetCountry)
          ) {
            setTargetCountry("AUTO");
          }
        } else {
          const fallbackStats = Array.from(
            onlyWorking.reduce((map, proxy) => {
              const code = normalizeCountryCode(proxy.countryCode);
              map.set(code, (map.get(code) ?? 0) + 1);
              return map;
            }, new Map<string, number>()),
          )
            .map(([countryCode, count]) => ({ countryCode, count }))
            .sort((a, b) => b.count - a.count);
          setCountryStats(fallbackStats);
        }
      } catch (error) {
        console.error("Failed to fetch proxies:", error);
      } finally {
        setProxyCheckLoading(false);
      }
    };

    checkProxies();
  }, [selectedProxyId, targetCountry]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasWorkingProxy) {
      toast.error("Khong co proxy WORKING nao. Vui long import proxy truoc.");
      return;
    }

    if (isDirectMode && !url.trim()) {
      toast.error("Vui long nhap URL can crawl");
      return;
    }

    if (!isDirectMode && !keyword.trim()) {
      toast.error("Vui long nhap tu khoa can tim");
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
          strategy,
          platform: "FACEBOOK",
          mode,
          url: isDirectMode ? url.trim() : undefined,
          keyword: isDirectMode ? undefined : keyword.trim(),
          scrapeMode,
          selectedProxyId: selectedProxyId || undefined,
          targetCountry,
          schedule: schedule.trim() || undefined,
          debugMode,
        }),
      });

      const payload = (await response.json()) as CreateCrawlerResponse;

      if (!response.ok || !payload.jobId) {
        throw new Error(payload.error ?? "Khong the tao crawler job");
      }

      toast.success(`Da tao job thanh cong: ${payload.jobId}`);
      setMode("DIRECT_URL");
      setUrl("");
      setKeyword("");
      setScrapeMode("PROFILE_AND_POST");
      setTargetCountry("AUTO");
      setSelectedProxyId("");
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
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Đang kiểm tra proxy...</span>
        </div>
      ) : !hasWorkingProxy ? (
        <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Không có proxy WORKING nào. Vui lòng import proxy trước khi tạo job.
          </span>
        </div>
      ) : null}

      <div className="space-y-4">
        {" "}
        {/* Tăng khoảng cách giữa các khối lớn */}
        {/* HÀNG TRÊN: PROXY COUNTRY (Full width) */}
        <div className="space-y-2">
          <label
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            htmlFor="crawler-target-country"
          >
            Proxy Country
          </label>
          <select
            id="crawler-target-country"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={targetCountry}
            onChange={(event) => setTargetCountry(event.target.value)}
            disabled={loading || !hasWorkingProxy}
          >
            <option value="AUTO">🌍 Auto (Random)</option>
            {countryStats.map((country) => (
              <option key={country.countryCode} value={country.countryCode}>
                {getCountryFlag(country.countryCode)} {country.countryCode} (
                {country.count} proxies)
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Worker sẽ ưu tiên proxy từ quốc gia này để tránh bị login
            wall/checkpoint.
          </p>
        </div>
        <hr className="my-2 border-muted/50" />{" "}
        {/* Thêm một đường kẻ mờ để phân khu cho đẹp */}
        {/* HÀNG DƯỚI: MODE SELECTION (2 cột song song) */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Crawler Mode</p>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Option: URL Trực tiếp */}
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all hover:bg-muted/50 ${
                mode === "DIRECT_URL"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : ""
              }`}
            >
              <input
                type="radio"
                name="crawler-mode"
                value="DIRECT_URL"
                checked={mode === "DIRECT_URL"}
                onChange={() => setMode("DIRECT_URL")}
                disabled={loading || !hasWorkingProxy}
                className="mt-1 size-4 accent-primary"
              />
              <div className="space-y-1">
                <span className="block font-semibold text-sm">
                  URL Trực tiếp
                </span>
                <span className="block text-xs text-muted-foreground leading-relaxed">
                  Crawl một trang cá nhân, hội nhóm hoặc bài viết cụ thể.
                </span>
              </div>
            </label>

            {/* Option: Tìm theo từ khóa */}
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all hover:bg-muted/50 ${
                mode === "SEARCH_KEYWORD"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : ""
              }`}
            >
              <input
                type="radio"
                name="crawler-mode"
                value="SEARCH_KEYWORD"
                checked={mode === "SEARCH_KEYWORD"}
                onChange={() => setMode("SEARCH_KEYWORD")}
                disabled={loading || !hasWorkingProxy}
                className="mt-1 size-4 accent-primary"
              />
              <div className="space-y-1">
                <span className="block font-semibold text-sm">
                  Tìm theo từ khóa
                </span>
                <span className="block text-xs text-muted-foreground leading-relaxed">
                  Sử dụng tính năng tìm kiếm của nền tảng để quét lead mới.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {isDirectMode ? (
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
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {isDirectMode ? null : (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="crawler-keyword">
              Keyword
            </label>
            <Input
              id="crawler-keyword"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="du lich, bat dong san, tuyen dung"
              disabled={loading || !hasWorkingProxy}
            />
          </div>
        )}

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
          <label className="text-sm font-medium" htmlFor="crawler-proxy-id">
            Proxy Cu The (optional)
          </label>
          <select
            id="crawler-proxy-id"
            className="border-input bg-background ring-offset-background w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            value={selectedProxyId}
            onChange={(event) => setSelectedProxyId(event.target.value)}
            disabled={loading || !hasWorkingProxy}
          >
            <option value="">Auto chon theo country</option>
            <optgroup label="Proxy cu the">
              {workingProxies.map((proxy) => {
                const code = normalizeCountryCode(proxy.countryCode);
                return (
                  <option key={proxy.id} value={proxy.id}>
                    🎯 {proxy.address}:{proxy.port} ({code})
                  </option>
                );
              })}
            </optgroup>
          </select>
          <p className="text-xs text-muted-foreground">
            Neu chon proxy cu the, worker uu tien dung dung proxy nay.
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
