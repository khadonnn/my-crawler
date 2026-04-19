"use client";

import { useSearchParams } from "next/navigation";

export default function DatasetsPage() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");

  return (
    <section className="space-y-2 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Datasets</h1>
      <p className="text-muted-foreground">
        Browse and manage extracted datasets from crawler runs.
      </p>
      {jobId ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          Dang xem du lieu cua job: {jobId}
        </p>
      ) : null}
    </section>
  );
}
