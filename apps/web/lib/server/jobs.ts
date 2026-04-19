import { getPrisma } from "@scraping-platform/db";

const FALLBACK_WORKER_URL = "http://localhost:10000";

type CreateCrawlerJobInput = {
  url: string;
  keyword?: string;
  scrapeMode?: "PROFILE_ONLY" | "POST_ONLY" | "PROFILE_AND_POST";
  proxyRegion?: "ANY" | "VN" | "US";
  schedule?: string;
  debugMode?: boolean;
};

export type JobListItem = {
  id: string;
  workerJobId: string | null;
  sourceType: string;
  sourceValue: string;
  keyword: string | null;
  debugMode: boolean;
  status: string;
  progress: number;
  leadCount: number;
  processedCount: number;
  errorMessage: string | null;
  blockedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

function getWorkerUrl() {
  return process.env.WORKER_API_BASE_URL ?? FALLBACK_WORKER_URL;
}

function getWorkerApiKey() {
  return process.env.CRAWLER_API_KEY ?? process.env.WORKER_API_KEY;
}

function buildWorkerHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const apiKey = getWorkerApiKey();
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  return headers;
}

function normalizeOptionalText(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

async function parseWorkerError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? `Worker error (${response.status})`;
  } catch {
    return `Worker error (${response.status})`;
  }
}

export async function createCrawlerJob(input: CreateCrawlerJobInput) {
  const url = input.url.trim();
  const keyword = normalizeOptionalText(input.keyword);
  const scrapeMode = input.scrapeMode ?? "PROFILE_AND_POST";
  const proxyRegion = input.proxyRegion ?? "ANY";
  const schedule = normalizeOptionalText(input.schedule);
  const debugMode = Boolean(input.debugMode);

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error("URL khong hop le");
  }

  const prisma = getPrisma();
  const job = await prisma.job.create({
    data: {
      sourceType: keyword ? "KEYWORD" : "GROUP_URL",
      sourceValue: url,
      keyword: keyword ?? null,
      status: "PENDING",
      progress: 0,
      debugMode,
    },
  });

  try {
    const workerResponse = await fetch(`${getWorkerUrl()}/api/scrape`, {
      method: "POST",
      headers: buildWorkerHeaders(),
      body: JSON.stringify({
        url,
        keyword,
        scrapeMode,
        proxyRegion,
        schedule,
        debugMode,
        clientJobId: job.id,
      }),
    });

    if (!workerResponse.ok) {
      throw new Error(await parseWorkerError(workerResponse));
    }

    const workerData = (await workerResponse.json()) as {
      jobId?: string;
    };

    const updatedJob = await prisma.job.update({
      where: { id: job.id },
      data: {
        workerJobId: workerData.jobId ?? null,
      },
    });

    return {
      job: updatedJob,
      workerId: workerData.jobId ?? null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Khong the dispatch worker";

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}

export async function listCrawlerJobs(limit = 100): Promise<JobListItem[]> {
  const prisma = getPrisma();

  const [jobs, profileGroups, postGroups] = await Promise.all([
    prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        workerJobId: true,
        sourceType: true,
        sourceValue: true,
        keyword: true,
        debugMode: true,
        status: true,
        progress: true,
        leadCount: true,
        processedCount: true,
        errorMessage: true,
        blockedReason: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.profile.groupBy({
      by: ["jobId"],
      _count: {
        _all: true,
      },
    }),
    prisma.post.groupBy({
      by: ["jobId"],
      _count: {
        _all: true,
      },
    }),
  ]);

  const profileByJobId = new Map(
    profileGroups.map((row) => [row.jobId, row._count._all]),
  );
  const postByJobId = new Map(
    postGroups.map((row) => [row.jobId, row._count._all]),
  );

  return jobs.map((job) => {
    const observedLeadCount =
      (profileByJobId.get(job.id) ?? 0) + (postByJobId.get(job.id) ?? 0);

    return {
      id: job.id,
      workerJobId: job.workerJobId,
      sourceType: job.sourceType,
      sourceValue: job.sourceValue,
      keyword: job.keyword,
      debugMode: job.debugMode,
      status: job.status,
      progress: job.progress,
      leadCount: Math.max(job.leadCount, observedLeadCount),
      processedCount: job.processedCount,
      errorMessage: job.errorMessage,
      blockedReason: job.blockedReason,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  });
}

export async function stopCrawlerJob(jobId: string) {
  const prisma = getPrisma();
  const result = await prisma.job.updateMany({
    where: {
      id: jobId,
      status: {
        in: ["PENDING", "RUNNING"],
      },
    },
    data: {
      status: "CANCELLED",
      finishedAt: new Date(),
    },
  });

  return result.count > 0;
}

export async function rerunCrawlerJob(
  jobId: string,
  options?: { debugMode?: boolean },
) {
  const prisma = getPrisma();
  const existing = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      sourceValue: true,
      keyword: true,
      debugMode: true,
    },
  });

  if (!existing) {
    throw new Error("Job khong ton tai");
  }

  return createCrawlerJob({
    url: existing.sourceValue,
    keyword: existing.keyword ?? undefined,
    debugMode: options?.debugMode ?? existing.debugMode,
  });
}
