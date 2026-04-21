import { FacebookDirectStrategy } from "../scrapers/facebook/facebook-direct.scraper.js";

function printUsage(): void {
  console.log("Usage: npm run poc:facebook:direct -- <facebook-url> [--debug]");
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const targetUrl = args.find((arg) => !arg.startsWith("--"));
  const debugMode = args.includes("--debug");

  if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
    printUsage();
    throw new Error("A valid Facebook URL is required");
  }

  const strategy = new FacebookDirectStrategy();
  const result = await strategy.execute({
    jobId: `poc-fb-direct-${Date.now()}`,
    platform: "FACEBOOK",
    mode: "DIRECT_URL",
    url: targetUrl,
    debugMode,
  });

  console.log("=== Facebook Direct Strategy Result ===");
  console.log(
    JSON.stringify(
      {
        url: result.url,
        title: result.title,
        crawledAt: result.crawledAt,
        previewSnippet: result.previewSnippet,
      },
      null,
      2,
    ),
  );

  console.log("=== Entities Summary ===");
  console.log(
    JSON.stringify(
      {
        posts: result.entities?.posts.length ?? 0,
        profiles: result.entities?.profiles.length ?? 0,
        interactions: result.entities?.interactions.length ?? 0,
      },
      null,
      2,
    ),
  );

  console.log("=== Entities Payload ===");
  console.log(JSON.stringify(result.entities ?? null, null, 2));
}

run().catch((error) => {
  console.error("Facebook direct strategy PoC failed:", error);
  process.exit(1);
});
