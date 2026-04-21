import { NewCrawlerForm } from "@/components/crawlers/new-crawler-form";

export default function NewCrawlerPage() {
  return (
    <section className="space-y-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create New Scraper
        </h1>
        <p className="text-muted-foreground">
          Cau hinh chi tiet crawler job: URL, keywords, profile/post scope,
          proxy region, va lich trinh.
        </p>
      </div>

      <div className="max-w-3xl mx-auto rounded-xl border p-4">
        <NewCrawlerForm />
      </div>
    </section>
  );
}
