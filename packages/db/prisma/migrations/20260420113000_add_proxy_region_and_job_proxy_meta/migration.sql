-- CreateEnum
CREATE TYPE "ProxyRegion" AS ENUM ('ANY', 'VN', 'US');

-- AlterTable
ALTER TABLE "Proxy"
ADD COLUMN "region" "ProxyRegion" NOT NULL DEFAULT 'ANY';

-- AlterTable
ALTER TABLE "Job"
ADD COLUMN "requestedProxyRegion" "ProxyRegion" NOT NULL DEFAULT 'ANY',
ADD COLUMN "usedProxyId" TEXT,
ADD COLUMN "usedProxyAddress" TEXT,
ADD COLUMN "usedProxyPort" INTEGER,
ADD COLUMN "usedProxyRegion" "ProxyRegion";

-- CreateIndex
CREATE INDEX "Proxy_region_idx" ON "Proxy"("region");

-- CreateIndex
CREATE INDEX "Job_requestedProxyRegion_idx" ON "Job"("requestedProxyRegion");
