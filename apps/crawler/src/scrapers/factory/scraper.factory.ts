import type { IScraperStrategy } from "../base/scraper.types.js";
import { FacebookScraper } from "../facebook/facebook.scraper.js";
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
    return new FacebookScraper();
  }

  return new GenericScraper();
}
