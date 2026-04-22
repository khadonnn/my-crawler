# GIẢI PHÁP: CRAWL ĐÚNG THÔNG TIN NGƯỜI REACTION/COMMENT

## 🔍 VẤN ĐỀ HIỆN TẠI

### Code hiện tại (facebook.scraper.ts lines 483-499):

```typescript
// ❌ WRONG: Gán profile ngẫu nhiên bằng round-robin
const commentInteractions = comments.map((comment, index) => ({
  type: "COMMENT",
  commentText: comment.text,
  profileFbUid: availableProfiles[index % availableProfiles.length].fbUid, // ❌ SAI
}));

const reactionInteractions = reactions.map((reaction, index) => ({
  type: "REACTION",
  reactionType: reaction.reactionType,
  profileFbUid: availableProfiles[index % availableProfiles.length].fbUid, // ❌ SAI
}));
```

### Kết quả:

- ✅ Có reaction type (LIKE, LOVE, etc.)
- ❌ KHÔNG có thông tin người reaction thực sự
- ❌ KHÔNG có tên người comment thực sự
- ❌ Profile được gán ngẫu nhiên (round-robin)

---

## ✅ GIẢI PHÁP 1: CRAWL REACTIONS POPUP (Recommended)

### Cách Facebook hiển thị reactions:

Khi click vào số reactions (ví dụ "6 reactions"), Facebook mở popup với danh sách người đã reaction:

```
[Popup]
👍 Nguyễn Văn A
❤️ Trần Thị B
😆 Lê Văn C
...
```

### Implementation:

```typescript
// apps/crawler/src/scrapers/facebook/facebook-reactions.scraper.ts

async function extractReactionsWithUsers(
  page: Page,
  postUrl: string,
): Promise<Array<{ name: string; profileUrl: string; reactionType: string }>> {
  const results = [];

  try {
    // 1. Tìm nút reactions count (ví dụ: "6 reactions", "10 người đã bày tỏ cảm xúc")
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

    // 2. Click để mở popup
    await reactionsButton.click();
    await page.waitForTimeout(2000); // Đợi popup load

    // 3. Scroll trong popup để load thêm reactions
    const popupSelector = '[role="dialog"], [role="complementary"]';
    const popup = page.locator(popupSelector).first();

    for (let i = 0; i < 3; i++) {
      await popup.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(1000);
    }

    // 4. Extract reactions với user info
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

        // Tìm reaction icon gần user name
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

    // 5. Đóng popup
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  } catch (error) {
    console.error("Failed to extract reactions with users:", error);
  }

  return results;
}
```

---

## ✅ GIẢI PHÁP 2: CRAWL COMMENTS VỚI USER INFO

### Cách Facebook hiển thị comments:

Comments thường có cấu trúc:

```html
<div role="article">
  <a href="profile_url">Nguyễn Văn A</a>
  <div dir="auto">Nội dung comment...</div>
</div>
```

### Implementation:

```typescript
// apps/crawler/src/scrapers/facebook/facebook-comments.scraper.ts

async function extractCommentsWithUsers(page: Page): Promise<
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
      // 1. Tìm user link (thường là <a> đầu tiên trong comment)
      const userLink = node.querySelector(
        'a[href*="facebook.com"]',
      ) as HTMLAnchorElement;
      if (!userLink) continue;

      const name = userLink.textContent?.trim() || "";
      const profileUrl = userLink.href;

      if (!name || name.length < 2 || !profileUrl.includes("facebook.com")) {
        continue;
      }

      // 2. Tìm comment text (thường là <div dir="auto">)
      const textNode = node.querySelector('div[dir="auto"]') as HTMLElement;
      if (!textNode) continue;

      const commentText = textNode.innerText?.trim() || "";
      if (commentText.length < 1 || commentText.length > 500) {
        continue;
      }

      // 3. Tìm comment ID
      let fbCommentId: string | undefined;
      const commentIdAttr = (node as HTMLElement).getAttribute(
        "data-commentid",
      );
      if (commentIdAttr) {
        fbCommentId = commentIdAttr;
      } else {
        // Tìm trong href của "Reply" button
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
```

---

## 🔧 TÍCH HỢP VÀO FACEBOOK SCRAPER

### Update `buildEntities()` function:

```typescript
function buildEntities(params: {
  url: string;
  title: string;
  rawText: string;
  profileCandidates: ExtractedProfileCandidate[];
  commentCandidates: Array<{
    name: string; // ✅ NEW: Tên người comment
    profileUrl: string; // ✅ NEW: Profile URL
    commentText: string;
    fbCommentId?: string;
  }>;
  reactionCandidates: Array<{
    name: string; // ✅ NEW: Tên người reaction
    profileUrl: string; // ✅ NEW: Profile URL
    reactionType: string;
  }>;
}): ScrapedEntities {
  // 1. Build profiles từ tất cả sources
  const profileMap = new Map<string, ScrapedProfileEntity>();

  // Add profiles từ page scan
  for (const item of params.profileCandidates) {
    const fbUid = parseFacebookProfileUid(item.profileUrl);
    profileMap.set(fbUid, {
      fbUid,
      name: item.name,
      profileUrl: item.profileUrl,
    });
  }

  // ✅ NEW: Add profiles từ comments
  for (const comment of params.commentCandidates) {
    const fbUid = parseFacebookProfileUid(comment.profileUrl);
    if (!profileMap.has(fbUid)) {
      profileMap.set(fbUid, {
        fbUid,
        name: comment.name,
        profileUrl: comment.profileUrl,
      });
    }
  }

  // ✅ NEW: Add profiles từ reactions
  for (const reaction of params.reactionCandidates) {
    const fbUid = parseFacebookProfileUid(reaction.profileUrl);
    if (!profileMap.has(fbUid)) {
      profileMap.set(fbUid, {
        fbUid,
        name: reaction.name,
        profileUrl: reaction.profileUrl,
      });
    }
  }

  const profiles = Array.from(profileMap.values());

  // 2. Build post
  const fallbackAuthor = profiles[0]?.name || params.title || "Facebook User";
  const post: ScrapedPostEntity = {
    fbPostId: parseFacebookPostId(params.url),
    postUrl: params.url,
    authorName: fallbackAuthor,
    content: params.rawText.slice(0, 2000),
  };

  // 3. ✅ NEW: Build comment interactions với ĐÚNG user
  const commentInteractions: ScrapedInteractionEntity[] =
    params.commentCandidates.map((comment) => {
      const profileFbUid = parseFacebookProfileUid(comment.profileUrl);
      return {
        type: "COMMENT",
        fbCommentId:
          comment.fbCommentId ??
          `c-${post.fbPostId}-${toStableNumericHash(comment.commentText)}`,
        fbPostId: post.fbPostId,
        commentText: comment.commentText,
        profileFbUid, // ✅ ĐÚNG user đã comment
      };
    });

  // 4. ✅ NEW: Build reaction interactions với ĐÚNG user
  const reactionInteractions: ScrapedInteractionEntity[] =
    params.reactionCandidates.map((reaction) => {
      const profileFbUid = parseFacebookProfileUid(reaction.profileUrl);
      return {
        type: "REACTION",
        reactionType:
          normalizeReactionTypeFromLabel(reaction.reactionType) ?? "LIKE",
        fbPostId: post.fbPostId,
        profileFbUid, // ✅ ĐÚNG user đã reaction
      };
    });

  return {
    posts: [post],
    profiles,
    interactions: [...commentInteractions, ...reactionInteractions],
  };
}
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Fix Comments (Dễ hơn)

- [ ] Update `extractCommentCandidates()` để return `{ name, profileUrl, commentText, fbCommentId }`
- [ ] Update `buildEntities()` để sử dụng đúng user từ comment data
- [ ] Test với 1 post có comments

### Phase 2: Fix Reactions (Khó hơn - cần click popup)

- [ ] Tạo `extractReactionsWithUsers()` function mới
- [ ] Implement logic click reactions button → open popup
- [ ] Implement scroll trong popup để load thêm reactions
- [ ] Extract reactions với user info từ popup
- [ ] Update `buildEntities()` để sử dụng đúng user từ reaction data
- [ ] Test với 1 post có reactions

### Phase 3: Integration

- [ ] Update `facebook.scraper.ts` để gọi functions mới
- [ ] Add error handling cho trường hợp popup không mở được
- [ ] Add fallback về logic cũ nếu không crawl được user info
- [ ] Test end-to-end với nhiều posts

---

## ⚠️ LƯU Ý

### 1. Facebook Anti-Bot

- Click vào reactions popup có thể trigger anti-bot detection
- Cần thêm delays và human-like behavior
- Có thể cần account session để xem reactions popup

### 2. Performance

- Crawl reactions với user info **chậm hơn** vì phải:
  - Click button
  - Đợi popup load
  - Scroll trong popup
  - Extract data
  - Đóng popup
- Nên thêm option để enable/disable deep reactions crawl

### 3. Limits

- Facebook giới hạn số reactions hiển thị trong popup (thường ~100-200)
- Nếu post có hàng nghìn reactions, chỉ crawl được một phần

---

## 🎯 KẾT QUẢ MONG ĐỢI

### Trước (hiện tại):

```
Reactions:
- User: [Random profile from page]
- Type: LIKE

Comments:
- User: [Random profile from page]
- Text: "Hay quá!"
```

### Sau (khi fix):

```
Reactions:
- User: Nguyễn Văn A (https://facebook.com/nguyenvana)
- Type: LIKE

- User: Trần Thị B (https://facebook.com/tranthib)
- Type: LOVE

Comments:
- User: Lê Văn C (https://facebook.com/levanc)
- Text: "Hay quá!"

- User: Phạm Thị D (https://facebook.com/phamthid)
- Text: "Cảm ơn bạn đã chia sẻ"
```

---

## 🚀 BẮT ĐẦU IMPLEMENT?

Bạn muốn tôi bắt đầu implement từ Phase nào?

1. **Phase 1 (Comments)** - Dễ hơn, không cần click popup
2. **Phase 2 (Reactions)** - Khó hơn, cần click popup và scroll
3. **Cả hai cùng lúc**
