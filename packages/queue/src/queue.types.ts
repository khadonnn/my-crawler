export type Platform =
  | "FACEBOOK"
  | "GOOGLE"
  | "YOUTUBE"
  | "TIKTOK"
  | "VOZ"
  | "TINHTE";

export type CrawlMode = "DIRECT_URL" | "SEARCH_KEYWORD";

export interface CrawlJobPayload {
  jobId: string;

  platform: Platform;
  mode: CrawlMode;

  url?: string;
  keyword?: string;

  selectedProxyId?: string;
  targetCountry?: string;
}
