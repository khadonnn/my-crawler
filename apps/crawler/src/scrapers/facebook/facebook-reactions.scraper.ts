import { Page } from "playwright";

export async function extractReactionsWithUsers(
  page: Page,
  postUrl: string,
): Promise<
  Array<{
    name: string;
    profileUrl: string;
    reactionType: string;
  }>
> {
  const results: Array<{
    name: string;
    profileUrl: string;
    reactionType: string;
  }> = [];

  try {
    // 1. Find reactions count button (various possible selectors)
    const reactionsButton = page
      .locator(
        '[aria-label*="reaction"], [aria-label*="cảm xúc"], a[href*="/ufi/reaction"]',
      )
      .first();

    const reactionsCount = await reactionsButton.count();
    if (reactionsCount === 0) {
      console.log("No reactions button found");
      return [];
    }

    // 2. Click to open popup
    await reactionsButton.first().click();
    await page.waitForTimeout(2000); // Wait for popup to load

    // 3. Scroll in popup to load more reactions
    const popupSelector = '[role="dialog"], [role="complementary"]';
    const popup = page.locator(popupSelector).first();

    for (let i = 0; i < 3; i++) {
      await popup.evaluate((el: HTMLElement) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(1000);
    }

    // 4. Extract reactions with user info
    const reactionsData = await page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll(
          '[role="dialog"] a[href*="facebook.com"], [role="complementary"] a[href*="facebook.com"]',
        ),
      );

      const reactions: Array<{
        name: string;
        profileUrl: string;
        reactionType: string;
      }> = [];

      for (const item of items) {
        const anchor = item as HTMLAnchorElement;
        const name = anchor.textContent?.trim() || "";
        const profileUrl = anchor.href;

        if (!name || name.length < 2 || !profileUrl.includes("facebook.com")) {
          continue;
        }

        // Find reaction icon near user name
        const parent = anchor.closest(
          '[role="listitem"], li, div[data-visualcompletion]',
        );
        if (!parent) continue;

        const ariaLabel = parent.getAttribute("aria-label") || "";
        let reactionType = "LIKE";

        if (ariaLabel.includes("love") || ariaLabel.includes("thương")) {
          reactionType = "LOVE";
        } else if (ariaLabel.includes("haha") || ariaLabel.includes("cười")) {
          reactionType = "HAHA";
        } else if (
          ariaLabel.includes("wow") ||
          ariaLabel.includes("ngạc nhiên")
        ) {
          reactionType = "WOW";
        } else if (ariaLabel.includes("sad") || ariaLabel.includes("buồn")) {
          reactionType = "SAD";
        } else if (
          ariaLabel.includes("angry") ||
          ariaLabel.includes("phẫn nộ")
        ) {
          reactionType = "ANGRY";
        }

        reactions.push({ name, profileUrl, reactionType });

        if (reactions.length >= 50) break; // Limit
      }

      return reactions;
    });

    results.push(...reactionsData);

    // 5. Close popup
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  } catch (error) {
    console.error("Failed to extract reactions with users:", error);
  }

  return results;
}
