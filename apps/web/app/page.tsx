import { getPrisma } from "@scraping-platform/db";

export default async function Home() {
  let jobCount = 0;
  let runningCount = 0;
  let recentJobs: Array<{
    id: string;
    sourceType: string;
    sourceValue: string;
    status: string;
    createdAt: Date;
  }> = [];
  let databaseMessage = "Database not connected yet";

  try {
    const prisma = getPrisma();

    [jobCount, runningCount, recentJobs] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { status: "RUNNING" } }),
      prisma.job.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          sourceType: true,
          sourceValue: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    databaseMessage = "Connected to Prisma Postgres";
  } catch (error) {
    databaseMessage =
      error instanceof Error ? error.message : "Unable to load database";
  }

  return (
    <>
      <section className="space-y-6 py-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">{databaseMessage}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total Jobs</p>
            <p className="text-3xl font-semibold">{jobCount}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Running Jobs</p>
            <p className="text-3xl font-semibold">{runningCount}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Connection</p>
            <p className="text-lg font-medium">{databaseMessage}</p>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">Recent Jobs</h2>
          {recentJobs.length > 0 ? (
            <ul className="space-y-3">
              {recentJobs.map((job) => (
                <li
                  key={job.id}
                  className="flex items-center justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{job.sourceValue}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.sourceType} • {job.status}
                    </p>
                  </div>
                  <time className="text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat("vi-VN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(job.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No jobs yet. Create the first crawl job from the dashboard.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
