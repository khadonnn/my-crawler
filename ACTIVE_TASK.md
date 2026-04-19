# ACTIVE TASK

## Current Focus

- External file-based memory system initialized for the Scraping Platform MVP.
- Scraper Worker architecture is documented under `.docs/system-design/`.
- Monorepo scaffold has been created with `apps/web`, `apps/crawler`, `packages/db`, and `packages/shared`.
- PostgreSQL Docker and Turbo workspace orchestration are now in place.

## Next Step

- Wire Prisma to the real database, migrate existing dashboard and worker code into the new workspace packages, and keep the worker API contract stable.

## Notes for Resume

- If the next session says "Resume work", read `FEATURES_DONE.md`, `ACTIVE_TASK.md`, and the latest plan file first.

##

tôi khi crawl data public trên facebook ví dụ từ reaction của những post nào đó thoả keyword tìm kiếm, hoặc comment từ bài viết, thì bảng của mình sẽ cần những cột gì ? nếu crawl thông tin người dùng public như sống ở đâu, từ quê nào, nam hay nữ, instagram hay các properties khác. Bạn góp ý giúp tôi để xây dựng shema prisma từ link doc: https://www.prisma.io/docs/prisma-orm/quickstart/prisma-postgres ; file shcema.prisma của họ: generator client {
provider = "prisma-client"
output = "../generated/prisma"
}

datasource db {
provider = "postgresql"
} , // 1. Bảng lưu trữ Bài Viết (Source)
// Lưu lại nguồn gốc nơi bạn quét được khách hàng để sau này phân tích ROI của keyword
model Post {
id String @id @default(uuid())
fbPostId String @unique // ID gốc của bài viết trên FB
postUrl String
authorName String // Tên Fanpage hoặc Group
content String? @db.Text
keywordMatched String? // Keyword nào đã kích hoạt việc cào bài này
scrapedAt DateTime @default(now())

interactions Interaction[]
}

// 2. Bảng lưu trữ Thông Tin Người Dùng (Leads)
// Lưu trữ các properties public phục vụ cho việc profiling
model Profile {
id String @id @default(uuid())
fbUid String @unique // User ID gốc của Facebook
name String
profileUrl String

// Các thông tin public (Có thể rỗng nếu user khóa profile)
gender String? // Nam / Nữ / Khác
currentCity String? // Nơi sống hiện tại
hometown String? // Quê quán
workplace String? // Nơi làm việc (Rất quan trọng để đánh giá lead)
education String? // Trường học

// Cross-platform links
instagramUrl String?
otherLinks Json? // Lưu mảng các link khác (Tiktok, Website cá nhân...)

// Metadata cho hệ thống
isProfileScraped Boolean @default(false) // Đánh dấu xem đã cho bot vào tận tường nhà quét chưa
leadScore Int @default(0) // Điểm đánh giá tiềm năng dựa trên AI
lastUpdated DateTime @updatedAt

interactions Interaction[]
}

// 3. Bảng lưu trữ Hành Vi (Reactions & Comments)
// Bảng trung gian nối Profile và Post
model Interaction {
id String @id @default(uuid())
type String // "REACTION" hoặc "COMMENT"

// Dành cho Reaction
reactionType String? // "LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY"

// Dành cho Comment
commentText String? @db.Text

// Khóa ngoại
profileId String
postId String
profile Profile @relation(fields: [profileId], references: [id])
post Post @relation(fields: [postId], references: [id])

interactedAt DateTime? // Thời gian user comment (nếu lấy được)
scrapedAt DateTime @default(now())

@@index([profileId])
@@index([postId])
}
