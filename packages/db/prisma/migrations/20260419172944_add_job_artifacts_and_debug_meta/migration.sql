/*
  Warnings:

  - A unique constraint covering the columns `[workerJobId]` on the table `Job` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "JobArtifactType" AS ENUM ('SCREENSHOT', 'RAW_EXTRACT');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "blockedReason" TEXT,
ADD COLUMN     "debugMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workerJobId" TEXT;

-- CreateTable
CREATE TABLE "JobArtifact" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "JobArtifactType" NOT NULL,
    "path" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobArtifact_jobId_idx" ON "JobArtifact"("jobId");

-- CreateIndex
CREATE INDEX "JobArtifact_type_idx" ON "JobArtifact"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Job_workerJobId_key" ON "Job"("workerJobId");

-- AddForeignKey
ALTER TABLE "JobArtifact" ADD CONSTRAINT "JobArtifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
