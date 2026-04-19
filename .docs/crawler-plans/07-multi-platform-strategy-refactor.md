# 07 - Multi-Platform Strategy Refactor

## Muc tieu

- Chuyen crawler tu dang monolithic sang kien truc Strategy Pattern theo platform.
- Dat nen tang de them platform moi (Facebook, Google, Forum, TikTok...) ma khong sua lon luong core.
- Giu kha nang debug manh ngay tu dau (logs, screenshots, raw extracts).

## Pham vi

### 1) Folder layout theo vai tro

- Tao `apps/crawler/pocs/` cho script test doc lap.
- Tao `apps/crawler/src/scrapers/` gom:
  - `base/` (contracts + abstract base scraper)
  - `facebook/` (facebook strategy)
  - `factory/` (router chon strategy)
- Tao `apps/crawler/src/observability/` gom logger, screenshot, retention.

### 2) Shared contracts

- Them `packages/shared/src/types/` cho kieu du lieu dung chung:
  - `ScrapeRequestInput`
  - `ScrapeResult`
  - `ExtractedPost`
  - `ExtractedProfile`
  - `ScraperPlatform`

### 3) Service orchestration only

- `scraper.service.ts` chi lam cac viec:
  - Tao jobId
  - Cap nhat status/progress
  - Goi factory chon scraper strategy
  - Ghi ket qua va xu ly loi
- Toan bo platform logic dua vao cac file strategy.

### 4) Debug mode

- Them `debugMode` vao payload tao job.
- Khi `debugMode=true`:
  - bat screenshot theo phase
  - ghi raw extract samples
  - tang muc do logs (phase/step/url)

## Rang buoc

- Khong pha vo API contract dang dung cho web app.
- Khong doi schema Prisma trong buoc refactor khung.
- Uu tien thay doi nho, co the merge tung phan.

## Lo trinh trien khai

### Phase 1 - Khung kien truc (an toan)

- Tao contracts cho base scraper.
- Tao factory route theo URL/platform.
- Tao facebook scraper toi thieu (placeholder + parse co ban).
- Refactor service de goi factory.

### Phase 2 - Observability first

- Them logger theo format: `jobId phase step message`.
- Them screenshot utility theo phase va error.
- Them retention utility xoa artifact qua han.

### Phase 3 - PoC + xac nhan

- Them `pocs/poc-facebook.ts`:
  - vao group public
  - scroll 3 lan
  - lay author + content
  - log ra terminal
- Chay PoC va luu artifact mau trong `storage/`.

### Phase 4 - Mo rong platform

- Them strategy thu 2 (google/forum) de kiem thu tinh mo rong cua factory.
- Danh gia lai contracts neu can.

## Dinh nghia done

- Co base scraper contract + factory hoat dong.
- Co it nhat 1 strategy production (`facebook`) chay duoc qua service.
- `debugMode` tao ra logs + screenshots co cau truc.
- PoC facebook co ket qua author/content in ra terminal.

## Checklist

- [ ] Tao `pocs/` o cap `apps/crawler/`
- [ ] Tao `src/scrapers/base/` (interface + abstract class)
- [ ] Tao `src/scrapers/facebook/` strategy dau tien
- [ ] Tao `src/scrapers/factory/scraper.factory.ts`
- [ ] Refactor `src/services/scraper.service.ts` thanh orchestration-only
- [ ] Tao `src/observability/logger.ts`
- [ ] Tao `src/observability/screenshot.ts`
- [ ] Tao `src/observability/retention.ts`
- [ ] Them shared types trong `packages/shared/src/types/`
- [ ] Bo sung script chay PoC trong `apps/crawler/package.json`
