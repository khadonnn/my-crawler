# PHÂN TÍCH & ĐỀ XUẤT BƯỚC TIẾP THEO

## 📊 ĐÁNH GIÁ HIỆN TRẠNG

### ✅ Những gì đã hoàn thành tốt:

1. **Hạ tầng vững chắc**: Monorepo + Turborepo + Docker + Prisma
2. **Crawler Facebook hoàn chỉnh**: Direct URL + Search Keyword với Playwright
3. **Production-ready features**:
   - Retry logic thông minh (exponential backoff)
   - Job locking & heartbeat
   - Progress tracking real-time
   - Proxy rotation với GeoIP
   - Cookie injection & session management
   - OCR với Tesseract.js đã tích hợp
4. **Dashboard đầy đủ**: KPI, charts, job management, datasets
5. **Schema Prisma tốt**: Job, Post, Profile, Interaction, Proxy, Account

### 🎯 Schema hiện tại CẦN CẢI TIẾN cho đa nền tảng:

#### ❌ Vấn đề 1: Schema quá Facebook-centric

```prisma
model Post {
  fbPostId String @unique  // ❌ Chỉ dành cho Facebook
  // Thiếu: platform field, generic postId
}

model Profile {
  fbUid String @unique     // ❌ Chỉ dành cho Facebook
  // Thiếu: platform field, generic userId
}
```

#### ❌ Vấn đề 2: Thiếu bảng cho đa nền tảng

- Không có bảng lưu **YouTube videos/channels**
- Không có bảng lưu **TikTok videos/users**
- Không có bảng lưu **Google Search results**

#### ❌ Vấn đề 3: Profile properties chưa đủ cho profiling

```prisma
model Profile {
  // ✅ Có: gender, currentCity, hometown, workplace, education
  // ❌ Thiếu:
  // - relationshipStatus (Độc thân/Đã kết hôn - quan trọng cho targeting)
  // - followersCount (Đánh giá influence)
  // - friendsCount (Đánh giá mạng lưới)
  // - bio/description (Phân tích AI)
  // - verifiedBadge (Uy tín)
  // - joinedDate (Đánh giá độ active)
  // - lastActivityDate (Lead còn sống không?)
  // - languages (Ngôn ngữ sử dụng)
  // - interests/hobbies (Sở thích - từ About section)
}
```

---

## 🎯 ĐỀ XUẤT SCHEMA MỚI (Multi-Platform Ready)

### 1️⃣ Refactor Post → Content (Generic)

```prisma
model Content {
  id              String   @id @default(uuid())
  jobId           String?

  // Multi-platform support
  platform        Platform              // FACEBOOK, YOUTUBE, TIKTOK, GOOGLE
  platformId      String                // fbPostId, ytVideoId, ttVideoId, etc.
  contentType     ContentType           // POST, VIDEO, SEARCH_RESULT, COMMENT

  // Common fields
  url             String
  authorId        String?               // Link to Profile
  authorName      String
  title           String?
  content         String?   @db.Text
  thumbnailUrl    String?

  // Metrics
  viewCount       Int?
  likeCount       Int?
  commentCount    Int?
  shareCount      Int?

  // Metadata
  keywordMatched  String?
  publishedAt     DateTime?
  scrapedAt       DateTime  @default(now())

  // Relations
  job             Job?          @relation(fields: [jobId], references: [id])
  author          Profile?      @relation(fields: [authorId], references: [id])
  interactions    Interaction[]

  @@unique([platform, platformId])
  @@index([jobId])
  @@index([platform])
  @@index([authorId])
}

enum ContentType {
  POST
  VIDEO
  SEARCH_RESULT
  ARTICLE
  COMMENT
  STORY
}
```

### 2️⃣ Refactor Profile → User (Generic + Rich Properties)

```prisma
model User {
  id               String    @id @default(uuid())
  jobId            String?

  // Multi-platform support
  platform         Platform
  platformUserId   String              // fbUid, ytChannelId, ttUserId, etc.
  username         String?             // @username handle

  // Basic info
  name             String
  profileUrl       String
  avatarUrl        String?
  coverPhotoUrl    String?
  bio              String?   @db.Text

  // Demographics (Facebook, TikTok)
  gender           String?             // Male, Female, Other
  age              Int?
  birthday         String?             // MM/DD format (year hidden)
  currentCity      String?
  hometown         String?
  country          String?
  languages        String[]            // ["Vietnamese", "English"]

  // Professional (Facebook, LinkedIn)
  workplace        String?
  position         String?
  education        String?

  // Social metrics
  followersCount   Int?
  followingCount   Int?
  friendsCount     Int?                // Facebook only
  subscribersCount Int?                // YouTube only
  totalLikes       Int?                // TikTok only
  totalVideos      Int?                // YouTube, TikTok

  // Status & verification
  isVerified       Boolean   @default(false)
  relationshipStatus String?           // Single, Married, In a relationship

  // Activity tracking
  joinedDate       DateTime?
  lastActivityDate DateTime?
  lastPostDate     DateTime?

  // Cross-platform links
  facebookUrl      String?
  instagramUrl     String?
  tiktokUrl        String?
  youtubeUrl       String?
  twitterUrl       String?
  linkedinUrl      String?
  websiteUrl       String?
  otherLinks       Json?

  // Interests & targeting (AI-extracted)
  interests        String[]            // ["Du lịch", "Ẩm thực", "Công nghệ"]
  hobbies          String[]

  // Lead scoring
  isProfileScraped Boolean   @default(false)
  leadScore        Int       @default(0)
  leadTags         String[]            // ["high-value", "tech-savvy", "entrepreneur"]

  // Contact (if available)
  email            String?
  phone            String?

  // Metadata
  scrapedAt        DateTime  @default(now())
  lastUpdated      DateTime  @updatedAt

  // Relations
  job              Job?          @relation(fields: [jobId], references: [id])
  interactions     Interaction[]
  contents         Content[]     // Content created by this user

  @@unique([platform, platformUserId])
  @@index([jobId])
  @@index([platform])
  @@index([leadScore])
}
```

### 3️⃣ Enhanced Interaction (Multi-Platform)

```prisma
model Interaction {
  id              String    @id @default(uuid())
  jobId           String?

  // Multi-platform support
  platform        Platform
  platformId      String?   @unique      // fbCommentId, ytCommentId, etc.

  // Type
  type            InteractionType        // REACTION, COMMENT, SHARE, SUBSCRIBE

  // Reaction (Facebook, YouTube, TikTok)
  reactionType    String?                // LIKE, LOVE, HAHA, WOW, SAD, ANGRY (FB)
                                         // LIKE, DISLIKE (YT)
                                         // HEART, LAUGH, WOW, SAD, ANGRY (TT)

  // Comment
  commentText     String?   @db.Text
  commentLikes    Int?
  commentReplies  Int?
  isReply         Boolean   @default(false)
  parentCommentId String?                // For nested comments

  // Relations
  userId          String
  contentId       String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  content         Content   @relation(fields: [contentId], references: [id], onDelete: Cascade)
  job             Job?      @relation(fields: [jobId], references: [id])

  // Timestamps
  interactedAt    DateTime?
  scrapedAt       DateTime  @default(now())

  @@unique([userId, contentId, type, platform], name: "unique_interaction")
  @@index([jobId])
  @@index([userId])
  @@index([contentId])
  @@index([platform])
}

enum InteractionType {
  REACTION
  COMMENT
  SHARE
  SUBSCRIBE
  FOLLOW
  SAVE
  REPOST
}
```

### 4️⃣ New: OCR Results Table (Tesseract.js)

```prisma
model OcrResult {
  id              String    @id @default(uuid())
  jobId           String

  // Source
  screenshotPath  String
  sourceUrl       String?

  // OCR output
  extractedText   String    @db.Text
  confidence      Float?                 // 0-100
  language        String    @default("vie+eng")

  // Structured data (if parsed)
  structuredData  Json?                  // Parsed phone, email, address, etc.

  // Metadata
  processingTime  Int?                   // milliseconds
  createdAt       DateTime  @default(now())

  // Relations
  job             Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
}
```

### 5️⃣ Enhanced Job for Multi-Platform

```prisma
model Job {
  // ... existing fields ...

  // Add new relations
  contents        Content[]
  users           User[]
  ocrResults      OcrResult[]

  // Add platform-specific config
  crawlConfig     Json?                  // Platform-specific settings
  // Example: { "maxScrolls": 5, "includeComments": true, "ocrEnabled": true }
}
```

---

## 🚀 ROADMAP ĐỀ XUẤT (Ưu tiên cao → thấp)

### 🔥 PHASE 1: Schema Migration (1-2 ngày)

**Mục tiêu**: Refactor schema để hỗ trợ đa nền tảng

- [ ] **Step 1.1**: Backup database hiện tại
- [ ] **Step 1.2**: Tạo migration script chuyển `Post` → `Content`
  - Map `fbPostId` → `platformId` với `platform=FACEBOOK`
  - Map `postUrl` → `url`
- [ ] **Step 1.3**: Tạo migration script chuyển `Profile` → `User`
  - Map `fbUid` → `platformUserId` với `platform=FACEBOOK`
  - Thêm các cột mới với giá trị NULL
- [ ] **Step 1.4**: Update `Interaction` với platform field
- [ ] **Step 1.5**: Thêm bảng `OcrResult`
- [ ] **Step 1.6**: Run migration & test
- [ ] **Step 1.7**: Update tất cả TypeScript types trong `packages/shared`
- [ ] **Step 1.8**: Update tất cả API routes & services

### 🎯 PHASE 2: Enhanced Facebook Crawler (2-3 ngày)

**Mục tiêu**: Crawl đầy đủ profile properties + OCR integration

- [ ] **Step 2.1**: Nâng cấp Facebook profile scraper
  - Crawl About section đầy đủ (relationship, interests, hobbies)
  - Crawl followers/friends count
  - Crawl last activity date
  - Extract cross-platform links
- [ ] **Step 2.2**: Tích hợp OCR vào workflow
  - Detect text trong screenshots (phone, email, address)
  - Parse structured data từ OCR text
  - Lưu vào bảng `OcrResult`
- [ ] **Step 2.3**: AI Lead Scoring
  - Implement scoring algorithm dựa trên:
    - Profile completeness
    - Activity level
    - Workplace/education quality
    - Engagement metrics
  - Auto-tag leads: "high-value", "tech-savvy", etc.
- [ ] **Step 2.4**: Update UI để hiển thị rich profile data

### 🌐 PHASE 3: YouTube Crawler (3-4 ngày)

**Mục tiêu**: Crawl YouTube videos, channels, comments

- [ ] **Step 3.1**: Tạo `YouTubeDirectStrategy`
  - Crawl video info (title, views, likes, description)
  - Crawl channel info (subscribers, videos count)
  - Crawl top comments
- [ ] **Step 3.2**: Tạo `YouTubeSearchStrategy`
  - Search videos by keyword
  - Collect search results
  - Deep crawl each video
- [ ] **Step 3.3**: Update UI với YouTube-specific fields
- [ ] **Step 3.4**: Test end-to-end

### 🎵 PHASE 4: TikTok Crawler (3-4 ngày)

**Mục tiêu**: Crawl TikTok videos, users, comments

- [ ] **Step 4.1**: Research TikTok anti-bot measures
  - TikTok có Cloudflare + device fingerprinting mạnh
  - Cần stealth plugin + realistic user behavior
- [ ] **Step 4.2**: Tạo `TikTokDirectStrategy`
  - Crawl video info (views, likes, shares, comments)
  - Crawl user profile (followers, total likes)
  - Crawl comments
- [ ] **Step 4.3**: Tạo `TikTokSearchStrategy`
  - Search videos/users by keyword
  - Collect hashtag results
- [ ] **Step 4.4**: Handle TikTok-specific challenges
  - Infinite scroll
  - Dynamic content loading
  - Rate limiting

### 🔍 PHASE 5: Google Search Crawler (2-3 ngày)

**Mục tiêu**: Crawl Google search results

- [ ] **Step 5.1**: Tạo `GoogleSearchStrategy`
  - Search by keyword
  - Collect organic results (title, URL, snippet)
  - Collect "People Also Ask"
  - Collect related searches
- [ ] **Step 5.2**: Handle Google anti-bot
  - CAPTCHA detection
  - Proxy rotation aggressive
  - Human-like delays
- [ ] **Step 5.3**: Store results vào `Content` với `contentType=SEARCH_RESULT`

### 📊 PHASE 6: Advanced Analytics & Export (2-3 ngày)

**Mục tiêu**: Phân tích leads và export data

- [ ] **Step 6.1**: Lead Analytics Dashboard
  - Lead score distribution chart
  - Demographics breakdown (gender, location, age)
  - Platform distribution
  - Engagement heatmap
- [ ] **Step 6.2**: Export features
  - Export to CSV/Excel với filters
  - Export to Google Sheets API
  - Webhook integration (send leads to CRM)
- [ ] **Step 6.3**: Lead enrichment
  - Auto-detect email/phone từ OCR
  - Cross-platform profile matching
  - Duplicate detection

---

## 🎯 ƯU TIÊN NGAY (Tuần này)

### 1. Schema Migration (CRITICAL)

**Tại sao**: Schema hiện tại không scale được cho đa nền tảng

**Action items**:

```bash
# 1. Backup DB
npm --workspace @scraping-platform/db run db:backup

# 2. Create migration
npm --workspace @scraping-platform/db run db:migrate -- --name refactor_to_multi_platform --create-only

# 3. Write migration SQL manually
# 4. Test migration on dev DB
# 5. Run migration
npm --workspace @scraping-platform/db run db:migrate

# 6. Regenerate Prisma Client
npm --workspace @scraping-platform/db run db:generate
```

### 2. Enhanced Facebook Profile Scraper

**Tại sao**: Hiện tại chỉ crawl basic info, thiếu nhiều properties quan trọng

**Action items**:

- Update `apps/crawler/src/scrapers/facebook/facebook.scraper.ts`
- Thêm logic crawl About section đầy đủ
- Thêm OCR cho screenshots có text (phone, email)

### 3. OCR Integration

**Tại sao**: Tesseract.js đã có nhưng chưa được sử dụng đầy đủ

**Action items**:

- Tạo `apps/crawler/src/services/ocr.service.ts`
- Integrate vào Facebook scraper workflow
- Parse structured data (phone, email, address) từ OCR text

---

## 💡 GỢI Ý KỸ THUẬT

### 1. Playwright + Tesseract.js Best Practices

```typescript
// apps/crawler/src/services/ocr.service.ts
import Tesseract from "tesseract.js";

export class OcrService {
  async extractText(imagePath: string, lang = "vie+eng") {
    const {
      data: { text, confidence },
    } = await Tesseract.recognize(imagePath, lang, {
      logger: (m) => console.log(m), // Progress logging
    });

    return {
      text,
      confidence,
      structuredData: this.parseStructuredData(text),
    };
  }

  private parseStructuredData(text: string) {
    // Extract phone numbers
    const phones = text.match(/(\+84|0)[0-9]{9,10}/g) || [];

    // Extract emails
    const emails =
      text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];

    // Extract addresses (Vietnam-specific)
    const addresses = text.match(/(Quận|Huyện|Phường|Xã)\s+[^,\n]+/g) || [];

    return { phones, emails, addresses };
  }
}
```

### 2. Multi-Platform Strategy Pattern

```typescript
// apps/crawler/src/scrapers/strategy-factory.ts
export function createScraperStrategy(options: {
  platform: Platform;
  mode: CrawlMode;
  url?: string;
  keyword?: string;
}): ScraperStrategy {
  const { platform, mode } = options;

  switch (platform) {
    case "FACEBOOK":
      return mode === "DIRECT_URL"
        ? new FacebookDirectStrategy(options)
        : new FacebookSearchStrategy(options);

    case "YOUTUBE":
      return mode === "DIRECT_URL"
        ? new YouTubeDirectStrategy(options)
        : new YouTubeSearchStrategy(options);

    case "TIKTOK":
      return mode === "DIRECT_URL"
        ? new TikTokDirectStrategy(options)
        : new TikTokSearchStrategy(options);

    case "GOOGLE":
      return new GoogleSearchStrategy(options);

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
```

### 3. Stealth Mode for Anti-Bot

```typescript
// apps/crawler/src/utils/stealth.ts
import { Page } from "playwright";

export async function applyStealthMode(page: Page) {
  // Override navigator.webdriver
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
  });

  // Randomize viewport
  const width = 1280 + Math.floor(Math.random() * 200);
  const height = 720 + Math.floor(Math.random() * 200);
  await page.setViewportSize({ width, height });

  // Randomize user agent
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...",
  ];
  await page.setExtraHTTPHeaders({
    "User-Agent": userAgents[Math.floor(Math.random() * userAgents.length)],
  });

  // Human-like mouse movements
  await page.mouse.move(Math.random() * width, Math.random() * height, {
    steps: 10,
  });
}
```

---

## 📝 KẾT LUẬN

### Bạn nên làm GÌ TIẾP THEO:

1. **NGAY BÂY GIỜ**: Refactor schema để hỗ trợ đa nền tảng (PHASE 1)
2. **TUẦN NÀY**: Nâng cấp Facebook crawler với rich profile data + OCR (PHASE 2)
3. **TUẦN SAU**: Implement YouTube crawler (PHASE 3)
4. **2 TUẦN NỮA**: Implement TikTok crawler (PHASE 4)

### Điểm mạnh của hệ thống hiện tại:

✅ Hạ tầng production-ready  
✅ Retry logic thông minh  
✅ Proxy rotation  
✅ OCR đã có sẵn  
✅ Dashboard đẹp

### Điểm cần cải thiện:

❌ Schema quá Facebook-centric  
❌ Profile properties chưa đủ cho lead profiling  
❌ OCR chưa được tận dụng  
❌ Chưa có crawler cho platform khác

**Bạn muốn tôi bắt đầu implement PHASE nào trước?** 🚀
