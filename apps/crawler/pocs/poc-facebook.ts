import { PlaywrightCrawler } from "crawlee";

async function run(): Promise<void> {
  const targetUrl = process.argv[2];

  if (!targetUrl) {
    console.error(
      "Usage: npm run poc:facebook -- <facebook-group-or-post-url>",
    );
    process.exit(1);
  }

  const crawler = new PlaywrightCrawler({
    headless: true,
    maxRequestsPerCrawl: 1,
    async requestHandler({ page, request, log }) {
      log.info(`POC start: ${request.loadedUrl}`);

      for (let i = 0; i < 3; i += 1) {
        await page.mouse.wheel(0, 2500);
        await page.waitForTimeout(1200);
      }

      const title = await page.title();
      const preview = (await page.locator("body").innerText())
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500);

      console.log({
        title,
        preview,
        url: request.loadedUrl,
        timestamp: new Date().toISOString(),
      });
    },
  });

  await crawler.run([targetUrl]);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
