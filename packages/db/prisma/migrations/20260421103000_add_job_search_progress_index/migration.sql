-- Add checkpoint index for resumable SEARCH_KEYWORD crawling.
ALTER TABLE "Job"
ADD COLUMN "searchProgressIndex" INTEGER NOT NULL DEFAULT 0;