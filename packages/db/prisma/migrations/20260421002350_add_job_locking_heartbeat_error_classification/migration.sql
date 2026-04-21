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
ADD COLUMN     "blockedReason_new" "BlockedReason";

-- Preserve old text values when possible during conversion to enum.
UPDATE "Job"
SET "blockedReason_new" = CASE
  WHEN "blockedReason" = 'LOGIN_WALL' THEN 'LOGIN_WALL'::"BlockedReason"
  WHEN "blockedReason" = 'CAPTCHA_WALL' THEN 'CAPTCHA'::"BlockedReason"
  WHEN "blockedReason" = 'CAPTCHA' THEN 'CAPTCHA'::"BlockedReason"
  WHEN "blockedReason" = 'TIMEOUT' THEN 'TIMEOUT'::"BlockedReason"
  WHEN "blockedReason" = 'NETWORK_ERROR' THEN 'NETWORK_ERROR'::"BlockedReason"
  WHEN "blockedReason" = 'NO_HEARTBEAT' THEN 'NO_HEARTBEAT'::"BlockedReason"
  WHEN "blockedReason" = 'EXTRACTION_LIMIT' THEN 'EXTRACTION_LIMIT'::"BlockedReason"
  WHEN "blockedReason" IS NULL THEN NULL
  ELSE 'UNKNOWN'::"BlockedReason"
END;

ALTER TABLE "Job"
DROP COLUMN "blockedReason",
RENAME COLUMN "blockedReason_new" TO "blockedReason";
