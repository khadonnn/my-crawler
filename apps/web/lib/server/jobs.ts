import { getPrisma } from "@scraping-platform/db";

const FALLBACK_WORKER_URL = "http://localhost:10000";

type CreateCrawlerJobInput = {
  url?: string;
  keyword?: string;
  platform?: "FACEBOOK" | "GOOGLE" | "YOUTUBE" | "TIKTOK";
  mode?: "DIRECT_URL" | "SEARCH_KEYWORD";
  scrapeMode?: "PROFILE_ONLY" | "POST_ONLY" | "PROFILE_AND_POST";
  proxyRegion?: "ANY" | "VN" | "US";
  selectedProxyId?: string;
  targetCountry?: string;
  schedule?: string;
  debugMode?: boolean;
};

export type JobListItem = {
  id: string;
  workerJobId: string | null;
  platform: "FACEBOOK" | "GOOGLE" | "YOUTUBE" | "TIKTOK";
  mode: "DIRECT_URL" | "SEARCH_KEYWORD";
  sourceType: string;
  sourceValue: string;
  url: string | null;
  keyword: string | null;
  searchProgressIndex: number;
  requestedProxyRegion: "ANY" | "VN" | "US";
  usedProxyId: string | null;
  usedProxyAddress: string | null;
  usedProxyPort: number | null;
  usedProxyRegion: "ANY" | "VN" | "US" | null;
  debugMode: boolean;
  status: string;
  progress: number;
  leadCount: number;
  processedCount: number;
  errorMessage: string | null;
  blockedReason: string | null;
  errorDetail: string | null;
  retryCount: number;
  maxRetry: number;
  retryScheduledFor: string | null;
  lockedBy: string | null;
  lockedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastHeartbeatAt: string | null;
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

function normalizeCountryCode(value?: string) {
  const normalized = value?.trim().toUpperCase();
  return normalized && normalized.length > 0 ? normalized : "AUTO";
}

function mapCountryCodeToLegacyRegion(
  countryCode: string,
): "ANY" | "VN" | "US" {
  return countryCode === "VN" ? "VN" : countryCode === "US" ? "US" : "ANY";
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
  const url = normalizeOptionalText(input.url);
  const keyword = normalizeOptionalText(input.keyword);
  const platform = input.platform ?? "FACEBOOK";
  const mode = input.mode ?? "DIRECT_URL";
  const scrapeMode = input.scrapeMode ?? "PROFILE_AND_POST";
  const targetCountry = normalizeCountryCode(input.targetCountry);
  const proxyRegion =
    input.proxyRegion ?? mapCountryCodeToLegacyRegion(targetCountry);
  const selectedProxyId = normalizeOptionalText(input.selectedProxyId);
  const schedule = normalizeOptionalText(input.schedule);
  const debugMode = Boolean(input.debugMode);

  if (mode === "DIRECT_URL" && (!url || !/^https?:\/\//.test(url))) {
    throw new Error("DIRECT_URL requires valid url");
  }

  if (mode === "SEARCH_KEYWORD" && !keyword) {
    throw new Error("SEARCH_KEYWORD requires keyword");
  }

  const sourceValue = url ?? keyword ?? "";

  const prisma = getPrisma();
  const job = await prisma.job.create({
    data: {
      platform,
      mode,
      sourceType: mode === "SEARCH_KEYWORD" ? "KEYWORD" : "GROUP_URL",
      sourceValue,
      url: url ?? null,
      keyword: keyword ?? null,
      searchProgressIndex: 0,
      requestedProxyRegion: proxyRegion,
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
        platform,
        mode,
        scrapeMode,
        proxyRegion,
        selectedProxyId,
        targetCountry,
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
        platform: true,
        mode: true,
        sourceType: true,
        sourceValue: true,
        url: true,
        keyword: true,
        searchProgressIndex: true,
        requestedProxyRegion: true,
        usedProxyId: true,
        usedProxyAddress: true,
        usedProxyPort: true,
        usedProxyRegion: true,
        debugMode: true,
        status: true,
        progress: true,
        leadCount: true,
        processedCount: true,
        errorMessage: true,
        blockedReason: true,
        errorDetail: true,
        retryCount: true,
        maxRetry: true,
        retryScheduledFor: true,
        lockedBy: true,
        lockedAt: true,
        startedAt: true,
        finishedAt: true,
        lastHeartbeatAt: true,
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
      platform: job.platform,
      mode: job.mode,
      sourceType: job.sourceType,
      sourceValue: job.sourceValue,
      url: job.url,
      keyword: job.keyword,
      searchProgressIndex: job.searchProgressIndex,
      requestedProxyRegion: job.requestedProxyRegion,
      usedProxyId: job.usedProxyId,
      usedProxyAddress: job.usedProxyAddress,
      usedProxyPort: job.usedProxyPort,
      usedProxyRegion: job.usedProxyRegion,
      debugMode: job.debugMode,
      status: job.status,
      progress: job.progress,
      leadCount: Math.max(job.leadCount, observedLeadCount),
      processedCount: job.processedCount,
      errorMessage: job.errorMessage,
      blockedReason: job.blockedReason,
      errorDetail: job.errorDetail,
      retryCount: job.retryCount,
      maxRetry: job.maxRetry,
      retryScheduledFor: job.retryScheduledFor?.toISOString() ?? null,
      lockedBy: job.lockedBy,
      lockedAt: job.lockedAt?.toISOString() ?? null,
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
      lastHeartbeatAt: job.lastHeartbeatAt?.toISOString() ?? null,
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
      url: true,
      keyword: true,
      platform: true,
      mode: true,
      requestedProxyRegion: true,
      debugMode: true,
    },
  });

  if (!existing) {
    throw new Error("Job khong ton tai");
  }

  return createCrawlerJob({
    url: existing.url ?? existing.sourceValue,
    keyword: existing.keyword ?? undefined,
    platform: existing.platform,
    mode: existing.mode,
    proxyRegion: existing.requestedProxyRegion,
    debugMode: options?.debugMode ?? existing.debugMode,
  });
}

export async function createReactionsCrawlJob(postId: string) {
  const prisma = getPrisma();

  const post = await prisma.post.findFirst({
    where: {
      OR: [{ id: postId }, { fbPostId: postId }],
    },
    select: {
      id: true,
      postUrl: true,
      keywordMatched: true,
    },
  });

  if (!post) {
    throw new Error("Post khong ton tai");
  }

  const created = await createCrawlerJob({
    url: post.postUrl,
    keyword: post.keywordMatched ?? undefined,
    scrapeMode: "POST_ONLY",
  });

  return {
    jobId: created.job.id,
    workerId: created.workerId,
    postId: post.id,
  };
}
