import type {
  IScraperStrategy,
  ScrapeExecutionInput,
  ScrapeOptions,
  ScrapeExecutionOutput,
} from "./scraper.types.js";

export abstract class BaseScraper implements IScraperStrategy {
  abstract readonly platform: string;

  abstract execute(
    input: ScrapeExecutionInput,
    options?: ScrapeOptions,
  ): Promise<ScrapeExecutionOutput>;

  protected createPreview(text: string, maxLength = 300): string {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength)}...`;
  }
}
