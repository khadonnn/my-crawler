-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobSourceType" AS ENUM ('GROUP_URL', 'KEYWORD');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('REACTION', 'COMMENT');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "sourceType" "JobSourceType" NOT NULL,
    "sourceValue" TEXT NOT NULL,
    "keyword" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "leadCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fbPostId" TEXT NOT NULL,
    "postUrl" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT,
    "keywordMatched" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fbUid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "gender" TEXT,
    "currentCity" TEXT,
    "hometown" TEXT,
    "workplace" TEXT,
    "education" TEXT,
    "instagramUrl" TEXT,
    "otherLinks" JSONB,
    "isProfileScraped" BOOLEAN NOT NULL DEFAULT false,
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL,
    "reactionType" "ReactionType",
    "commentText" TEXT,
    "profileId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "interactedAt" TIMESTAMP(3),
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_sourceType_idx" ON "Job"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "Post_fbPostId_key" ON "Post"("fbPostId");

-- CreateIndex
CREATE INDEX "Post_jobId_idx" ON "Post"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_fbUid_key" ON "Profile"("fbUid");

-- CreateIndex
CREATE INDEX "Profile_jobId_idx" ON "Profile"("jobId");

-- CreateIndex
CREATE INDEX "Interaction_jobId_idx" ON "Interaction"("jobId");

-- CreateIndex
CREATE INDEX "Interaction_profileId_idx" ON "Interaction"("profileId");

-- CreateIndex
CREATE INDEX "Interaction_postId_idx" ON "Interaction"("postId");

-- CreateIndex
CREATE INDEX "Interaction_type_idx" ON "Interaction"("type");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
