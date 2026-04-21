/*
  Warnings:

  - The `reactionType` column on the `Interaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[fbCommentId]` on the table `Interaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[profileId,postId,type]` on the table `Interaction` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `type` on the `Interaction` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('FACEBOOK', 'GOOGLE', 'YOUTUBE', 'TIKTOK');

-- CreateEnum
CREATE TYPE "CrawlMode" AS ENUM ('DIRECT_URL', 'SEARCH_KEYWORD');

-- DropForeignKey
ALTER TABLE "Interaction" DROP CONSTRAINT "Interaction_jobId_fkey";

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_jobId_fkey";

-- DropForeignKey
ALTER TABLE "Profile" DROP CONSTRAINT "Profile_jobId_fkey";

-- DropIndex
DROP INDEX "Interaction_type_idx";

-- DropIndex
DROP INDEX "Job_requestedProxyRegion_idx";

-- DropIndex
DROP INDEX "Proxy_region_idx";

-- AlterTable
ALTER TABLE "Interaction" ADD COLUMN     "fbCommentId" TEXT,
ALTER COLUMN "jobId" DROP NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL,
DROP COLUMN "reactionType",
ADD COLUMN     "reactionType" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "mode" "CrawlMode" NOT NULL DEFAULT 'DIRECT_URL',
ADD COLUMN     "platform" "Platform" NOT NULL DEFAULT 'FACEBOOK',
ADD COLUMN     "url" TEXT;

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "jobId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "jobId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Interaction_fbCommentId_key" ON "Interaction"("fbCommentId");

-- CreateIndex
CREATE UNIQUE INDEX "Interaction_profileId_postId_type_key" ON "Interaction"("profileId", "postId", "type");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
