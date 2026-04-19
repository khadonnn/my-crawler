import { getPrisma } from "@scraping-platform/db";
import { NextResponse } from "next/server";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildWeeklyLabels() {
  const labels: Date[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    labels.push(startOfDay(day));
  }

  return labels;
}

export async function GET() {
  try {
    const prisma = getPrisma();
    const weekDays = buildWeeklyLabels();
    const weekStart = weekDays[0];

    const [
      profileCount,
      postCount,
      runningJobs,
      weeklyJobs,
      potentialProfiles,
      totalProfiles,
    ] = await Promise.all([
      prisma.profile.count(),
      prisma.post.count(),
      prisma.job.findMany({
        where: { status: "RUNNING" },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          sourceType: true,
          sourceValue: true,
          status: true,
          progress: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.job.findMany({
        where: { createdAt: { gte: weekStart } },
        select: {
          createdAt: true,
          processedCount: true,
          leadCount: true,
        },
      }),
      prisma.profile.count({
        where: {
          leadScore: {
            gte: 60,
          },
        },
      }),
      prisma.profile.count(),
    ]);

    const weeklyMap = new Map<string, number>();

    for (const day of weekDays) {
      weeklyMap.set(startOfDay(day).toISOString(), 0);
    }

    for (const job of weeklyJobs) {
      const key = startOfDay(job.createdAt).toISOString();
      const prev = weeklyMap.get(key) ?? 0;
      const value = Math.max(job.processedCount, job.leadCount, 0);
      weeklyMap.set(key, prev + value);
    }

    const growth = weekDays.map((day) => {
      const key = startOfDay(day).toISOString();

      return {
        day: new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(day),
        value: weeklyMap.get(key) ?? 0,
      };
    });

    const neutralProfiles = Math.max(totalProfiles - potentialProfiles, 0);

    return NextResponse.json({
      kpis: {
        totalLeads: profileCount + postCount,
        runningTasks: runningJobs.length,
      },
      growth,
      quality: [
        { name: "Potential", value: potentialProfiles },
        { name: "Neutral", value: neutralProfiles },
      ],
      runningTasks: runningJobs,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        kpis: {
          totalLeads: 0,
          runningTasks: 0,
        },
        growth: [],
        quality: [
          { name: "Potential", value: 0 },
          { name: "Neutral", value: 0 },
        ],
        runningTasks: [],
        updatedAt: new Date().toISOString(),
        message:
          error instanceof Error ? error.message : "Unable to load dashboard",
      },
      { status: 200 },
    );
  }
}
