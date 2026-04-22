import { Page } from "playwright";

export async function extractCommentsWithUsers(page: Page): Promise<
  Array<{
    name: string;
    profileUrl: string;
    commentText: string;
    fbCommentId?: string;
  }>
> {
  return page.evaluate(() => {
    const commentNodes = Array.from(
      document.querySelectorAll(
        'div[role="article"], ul[role="list"] > li, div[data-ad-preview="message"]',
      ),
    );

    const comments: Array<{
      name: string;
      profileUrl: string;
      commentText: string;
      fbCommentId?: string;
    }> = [];

    for (const node of commentNodes) {
      // 1. Find user link (usually first <a> in comment)
      const userLink = node.querySelector(
        'a[href*="facebook.com"]',
      ) as HTMLAnchorElement;
      if (!userLink) continue;

      const name = userLink.textContent?.trim() || "";
      const profileUrl = userLink.href;

      if (!name || name.length < 2 || !profileUrl.includes("facebook.com")) {
        continue;
      }

      // 2. Find comment text (usually <div dir="auto">)
      const textNode = node.querySelector('div[dir="auto"]') as HTMLElement;
      if (!textNode) continue;

      const commentText = textNode.innerText?.trim() || "";
      if (commentText.length < 1 || commentText.length > 500) {
        continue;
      }

      // 3. Find comment ID
      let fbCommentId: string | undefined;
      const commentIdAttr = (node as HTMLElement).getAttribute(
        "data-commentid",
      );
      if (commentIdAttr) {
        fbCommentId = commentIdAttr;
      } else {
        // Find in href of "Reply" button
        const replyLink = node.querySelector(
          'a[href*="comment_id="]',
        ) as HTMLAnchorElement;
        if (replyLink) {
          const match = replyLink.href.match(/comment_id=(\d+)/);
          if (match) {
            fbCommentId = match[1];
          }
        }
      }

      comments.push({
        name,
        profileUrl,
        commentText,
        fbCommentId,
      });

      if (comments.length >= 50) break; // Limit
    }

    return comments;
  });
}
