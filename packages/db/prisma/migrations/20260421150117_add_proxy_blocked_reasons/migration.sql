-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BlockedReason" ADD VALUE 'NO_PROXY_IN_POOL';
ALTER TYPE "BlockedReason" ADD VALUE 'NO_PROXY_AVAILABLE';
ALTER TYPE "BlockedReason" ADD VALUE 'PROXY_REQUIRED';
ALTER TYPE "BlockedReason" ADD VALUE 'IP_LEAK_DETECTED';
ALTER TYPE "BlockedReason" ADD VALUE 'IP_VERIFICATION_FAILED';
