export interface ScrapeExecutionInput {
  jobId: string;
  url: string;
  debugMode?: boolean;
}

export interface ScrapeExecutionOutput {
  url: string;
  title: string;
  previewSnippet: string;
  crawledAt: string;
}

export interface IScraperStrategy {
  readonly platform: string;
  execute(input: ScrapeExecutionInput): Promise<ScrapeExecutionOutput>;
}
