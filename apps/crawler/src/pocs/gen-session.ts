import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.pause();
      resolve();
    });
  });
}

async function run(): Promise<void> {
  const browser = await chromium.launch({ headless: false });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://www.facebook.com", {
      waitUntil: "domcontentloaded",
    });

    console.log("Dang nhap xong nhan ENTER de luu session");
    await waitForEnter();

    const cookiesDir = path.resolve(process.cwd(), "storage", "cookies");
    fs.mkdirSync(cookiesDir, { recursive: true });

    const storageStatePath = path.join(cookiesDir, "facebook-session.json");
    await context.storageState({ path: storageStatePath });

    console.log("Session saved:", storageStatePath);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
