/*
  Warnings:

  - The `blockedReason` column on the `Job` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "BlockedReason" AS ENUM ('LOGIN_WALL', 'CAPTCHA', 'TIMEOUT', 'NETWORK_ERROR', 'NO_HEARTBEAT', 'EXTRACTION_LIMIT', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "errorDetail" TEXT,
ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedBy" TEXT,
ADD COLUMN     "maxRetry" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retryScheduledFor" TIMESTAMP(3),
DROP COLUMN "blockedReason",
ADD COLUMN     "blockedReason" "BlockedReason";
