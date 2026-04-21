import type { Page } from "playwright";

import { ScraperError } from "../../errors/scraper.error.js";
import { logJobEvent } from "../../observability/index.js";
import type { SelectedProxyConfig } from "./scraper.types.js";

const IP_VERIFY_TIMEOUT_MS = 10_000;

function parseIpFromPayload(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const maybeIp = (payload as { ip?: unknown }).ip;
  if (typeof maybeIp !== "string") {
    return null;
  }

  const normalized = maybeIp.trim();
  return normalized.length > 0 ? normalized : null;
}

export function enforceProxyRequired(proxy?: SelectedProxyConfig): void {
  if (process.env.REQUIRE_PROXY === "true" && !proxy) {
    throw new ScraperError(
      "PROXY_REQUIRED",
      "System requires proxy but none was provided",
    );
  }
}

export function isLocalIp(ip: string): boolean {
  const normalizedIp = ip.trim();
  const serverPublicIp = process.env.SERVER_PUBLIC_IP?.trim();

  if (!normalizedIp) {
    return true;
  }

  if (serverPublicIp && normalizedIp === serverPublicIp) {
    return true;
  }

  return (
    normalizedIp === "localhost" ||
    normalizedIp === "127.0.0.1" ||
    normalizedIp === "::1" ||
    normalizedIp.startsWith("10.") ||
    normalizedIp.startsWith("192.168.") ||
    normalizedIp.startsWith("172.16.") ||
    normalizedIp.startsWith("172.17.") ||
    normalizedIp.startsWith("172.18.") ||
    normalizedIp.startsWith("172.19.") ||
    normalizedIp.startsWith("172.2") ||
    normalizedIp.startsWith("172.30.") ||
    normalizedIp.startsWith("172.31.") ||
    normalizedIp.startsWith("169.254.") ||
    normalizedIp.startsWith("fc") ||
    normalizedIp.startsWith("fd") ||
    normalizedIp.startsWith("fe80:")
  );
}

export async function closeBrowserSafely(page: Page): Promise<void> {
  try {
    const browser = page.context().browser();
    if (browser?.isConnected()) {
      await browser.close();
    }
  } catch {
    // Swallow close failures to preserve original error handling path.
  }
}

export async function verifyProxyEgressIp(params: {
  page: Page;
  jobId: string;
  platform: string;
  proxy: SelectedProxyConfig;
}): Promise<string> {
  const { page, jobId, platform, proxy } = params;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new ScraperError(
            "IP_VERIFICATION_FAILED",
            "Failed to verify proxy IP",
          ),
        );
      }, IP_VERIFY_TIMEOUT_MS);
    });

    const response = await Promise.race([
      page.goto("https://api.ipify.org?format=json", {
        waitUntil: "domcontentloaded",
      }),
      timeoutPromise,
    ]);

    if (!response) {
      throw new ScraperError(
        "IP_VERIFICATION_FAILED",
        "Failed to verify proxy IP",
      );
    }

    const payload = await response.json();
    const publicIp = parseIpFromPayload(payload);
    if (!publicIp) {
      throw new ScraperError(
        "IP_VERIFICATION_FAILED",
        "Failed to verify proxy IP",
      );
    }

    logJobEvent("info", {
      jobId,
      platform,
      phase: "proxy",
      step: "ip-verification",
      message: "Runtime proxy IP verification completed",
      meta: {
        detectedIp: publicIp,
        proxyExpected: proxy.ip,
      },
    });

    if (isLocalIp(publicIp)) {
      throw new ScraperError(
        "IP_LEAK_DETECTED",
        `Detected local IP: ${publicIp}`,
      );
    }

    return publicIp;
  } catch (error) {
    if (error instanceof ScraperError) {
      throw error;
    }

    throw new ScraperError(
      "IP_VERIFICATION_FAILED",
      "Failed to verify proxy IP",
    );
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
