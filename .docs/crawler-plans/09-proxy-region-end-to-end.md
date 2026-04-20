# Plan 09: Proxy Region End-to-End

## Goal

Bien `Proxy Region` thanh luong thuc thi that su:

- Luu region cho moi proxy trong DB.
- Hien region tren trang `/proxies`.
- Worker nhan `proxyRegion`, chon proxy WORKING phu hop, va su dung khi crawl.
- Luu thong tin proxy da su dung vao job de co the doi chieu.

## Scope

- Prisma schema + migration SQL.
- Web API proxies/jobs.
- UI trang proxies va crawlers.
- Worker controller/service + scraper input.

## Implementation Steps

1. Them `ProxyRegion` enum va field region cho `Proxy`.
2. Them metadata su dung proxy vao `Job` (`requestedProxyRegion`, `usedProxy*`).
3. Cap nhat API import/create proxy de nhan region.
4. Cap nhat UI proxies table hien region.
5. Truyen `proxyRegion` vao worker API va add vao service options.
6. Worker chon proxy theo region + status, tao proxy URL, truyen vao scraper.
7. Generic/Facebook scraper dung proxy configuration khi co proxy URL.
8. Cap nhat jobs list de hien proxy da dung.
9. Generate Prisma client va kiem tra loi TypeScript.

## Acceptance

- `/proxies` hien cot Region.
- Tao job voi `Proxy Region = VN/US` se uu tien dung proxy cung region.
- Job history hien thong tin proxy da dung.
- Khong co loi TypeScript do thay doi schema.
