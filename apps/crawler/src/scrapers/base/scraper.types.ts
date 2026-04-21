export type ProxyRegion = "ANY" | "VN" | "US";
export type Platform = "FACEBOOK" | "GOOGLE" | "YOUTUBE" | "TIKTOK";
export type CrawlMode = "DIRECT_URL" | "SEARCH_KEYWORD";

export interface SelectedProxyConfig {
  id: string;
  address: string;
  port: number;
  region: ProxyRegion;
  protocol: string;
  url: string;
}

export interface ScrapeExecutionInput {
  jobId: string;
  platform?: Platform;
  mode?: CrawlMode;
  url?: string;
  keyword?: string;
  debugMode?: boolean;
  proxy?: SelectedProxyConfig;
  onProgress?: (progress: number, step?: string) => Promise<void> | void;
}

export interface ScrapedPostEntity {
  fbPostId: string;
  postUrl: string;
  authorName: string;
  content?: string;
  keywordMatched?: string;
}

export interface ScrapedProfileEntity {
  fbUid: string;
  name: string;
  profileUrl: string;
}

export interface ScrapedInteractionEntity {
  type: "REACTION" | "COMMENT";
  reactionType?: "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD" | "ANGRY";
  fbCommentId?: string;
  commentText?: string;
  profileFbUid: string;
  interactedAt?: string;
}

export interface ScrapedEntities {
  posts: ScrapedPostEntity[];
  profiles: ScrapedProfileEntity[];
  interactions: ScrapedInteractionEntity[];
}

export interface ScrapeExecutionOutput {
  url: string;
  title: string;
  previewSnippet: string;
  crawledAt: string;
  entities?: ScrapedEntities;
}

export interface IScraperStrategy {
  readonly platform: string;
  execute(input: ScrapeExecutionInput): Promise<ScrapeExecutionOutput>;
}
