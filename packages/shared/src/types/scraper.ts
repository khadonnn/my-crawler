export type ScraperPlatform = "facebook" | "google" | "forum" | "generic";

export interface ScrapeRequestInput {
  url: string;
  debugMode?: boolean;
}

export interface ExtractedPost {
  postUrl?: string;
  author?: string;
  content?: string;
  interactedAt?: string;
}

export interface ExtractedProfile {
  profileUrl?: string;
  name?: string;
  currentCity?: string;
  hometown?: string;
  workplace?: string;
}

export interface ScrapeResult {
  platform: ScraperPlatform;
  url: string;
  title: string;
  previewSnippet: string;
  crawledAt: string;
}
