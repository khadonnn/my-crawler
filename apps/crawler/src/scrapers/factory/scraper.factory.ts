import type {
  CrawlMode,
  IScraperStrategy,
  Platform,
} from "../base/scraper.types.js";
import { FacebookDirectStrategy } from "../facebook/facebook-direct.scraper.js";
import { FacebookSearchStrategy } from "../facebook/facebook-search.scraper.js";
import { GenericScraper } from "../generic/generic.scraper.js";

const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
]);

export function createScraperForUrl(url: string): IScraperStrategy {
  let hostname = "";

  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return new GenericScraper();
  }

  if (FACEBOOK_HOSTS.has(hostname)) {
    return new FacebookDirectStrategy();
  }

  return new GenericScraper();
}

type CreateScraperStrategyInput = {
  platform?: Platform;
  mode?: CrawlMode;
  url?: string;
};

export function createScraperStrategy(
  input: CreateScraperStrategyInput,
): IScraperStrategy {
  const platform = input.platform ?? "FACEBOOK";
  const mode = input.mode ?? "DIRECT_URL";

  if (platform === "FACEBOOK" && mode === "DIRECT_URL") {
    if (input.url) {
      return createScraperForUrl(input.url);
    }

    return new FacebookDirectStrategy();
  }

  if (platform === "FACEBOOK" && mode === "SEARCH_KEYWORD") {
    return new FacebookSearchStrategy();
  }

  return new GenericScraper();
}
