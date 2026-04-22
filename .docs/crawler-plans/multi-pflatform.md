Kết luận trước cho bạn

❌ KHÔNG nên giữ kiểu:

facebook-direct.scraper.ts
facebook-search.scraper.ts

✅ NÊN dùng:

platform + strategy + extractor + adapter
🧠 Vấn đề lớn nhất bạn đang gặp

Bạn có 2 chiều (dimension):

1. Platform
   FACEBOOK
   GOOGLE
   YOUTUBE
   VOZ
   ...
2. Mode
   DIRECT_URL
   SEARCH_KEYWORD
   (sắp tới chắc chắn có:)
   PROFILE
   GROUP
   HASHTAG
   ❌ Sai lầm phổ biến (bạn đang dính)
   facebook/
   ├── facebook-direct.scraper.ts
   ├── facebook-search.scraper.ts
   ├── facebook-profile.scraper.ts (sắp tới)
   ├── facebook-group.scraper.ts (sắp tới)

👉 Kết quả:

nổ file
duplicate logic
khó maintain
✅ Kiến trúc đúng (clean & scalable)

👉 TÁCH 2 DIMENSION RA

🧱 CẤU TRÚC CHUẨN (MÌNH CHỐT CHO BẠN)
src/scrapers/

├── core/ ⭐ hệ thống lõi
│ ├── base.scraper.ts
│ ├── scraper.types.ts
│ ├── scraper.interface.ts
│ ├── strategy.interface.ts
│ └── proxy/
│ └── proxy-safety.ts
│
├── factory/
│ ├── scraper.factory.ts ⭐ combine platform + strategy
│ └── strategy.factory.ts
│
├── strategies/ ⭐ CHỈ chứa MODE
│ ├── direct-url/
│ │ └── direct-url.strategy.ts
│ │
│ ├── search-keyword/
│ │ └── search-keyword.strategy.ts
│ │
│ ├── profile/
│ ├── hashtag/
│ └── index.ts
│
├── platforms/ ⭐ CHỈ chứa LOGIC PLATFORM
│ ├── facebook/
│ │ ├── facebook.scraper.ts ⭐ orchestrator
│ │ ├── facebook.adapter.ts ⭐ normalize data
│ │ ├── facebook.selectors.ts
│ │ │
│ │ ├── extractors/
│ │ │ ├── post.extractor.ts
│ │ │ ├── comment.extractor.ts
│ │ │ └── reaction.extractor.ts
│ │ │
│ │ └── mappers/
│ │ └── facebook.mapper.ts
│ │
│ ├── google/
│ │ ├── google.scraper.ts
│ │ ├── google.adapter.ts
│ │ └── extractors/
│ │ └── search.extractor.ts
│ │
│ ├── youtube/
│ │ ├── youtube.scraper.ts
│ │ └── extractors/
│ │ ├── video.extractor.ts
│ │ └── comment.extractor.ts
│ │
│ ├── voz/
│ └── tinhte/
│
├── generic/
│ └── generic.scraper.ts
│
└── utils/
├── delay.ts
├── scroll.ts
└── dom.utils.ts
💥 CÁI QUAN TRỌNG NHẤT (đừng bỏ qua)
👉 Platform KHÔNG biết mode
👉 Strategy KHÔNG biết platform
🔁 Cách hoạt động đúng
const strategy = new SearchKeywordStrategy();
const scraper = new FacebookScraper(strategy);

await scraper.run();
🧠 Bên trong sẽ như này:
Strategy:
quyết định:
search URL
danh sách link
flow
Platform:
quyết định:
DOM
selector
extract data
🎯 Lợi ích cực lớn

1. Không duplicate code

Không còn:

facebook-direct
facebook-search 2. Thêm mode cực dễ
class HashtagStrategy {}
class ProfileStrategy {}

👉 KHÔNG cần đụng Facebook code

3. Scale đa platform

Bạn chỉ cần:

new GoogleScraper(strategy)
new YoutubeScraper(strategy) 4. Dễ test

Bạn test riêng:

strategy
extractor
adapter
⚠️ Cái bạn phải sửa NGAY
❌ Hiện tại bạn đang:
merge search + direct vào strategy (OK)
nhưng platform vẫn đang làm quá nhiều
✅ Nên refactor tiếp:

1. Tách extractor
   facebook.scraper.ts ❌ 1000 dòng

👉 thành:

post.extractor.ts
comment.extractor.ts
reaction.extractor.ts 2. Tách adapter
raw Facebook DOM → CrawlResult chuẩn 3. Tách selector

👉 tránh:

page.locator('div.x1...')
