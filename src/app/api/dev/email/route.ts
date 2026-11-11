import { NextResponse } from "next/server";
import { renderHtml } from "@/lib/alerts";
import { searchJobs } from "@/lib/query";

export const dynamic = "force-dynamic";

/** Dev only: preview the alert email with real jobs at /api/dev/email */
export async function GET() {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const a = await searchJobs({ category: ["Engineering"], visa: ["Yes"], usOnly: true, pageSize: 3 });
  const b = await searchJobs({ remote: true, usOnly: true, pageSize: 2 });
  const search = (id: number, name: string, query: string) =>
    ({ id, name, query, userId: "dev", alertsEnabled: true, frequency: "daily", lastAlertedAt: new Date(), createdAt: new Date() });
  const html = renderHtml("Alex Chen", a.total + b.total, [
    { search: search(1, "Engineering · Sponsors visa", "category=Engineering&visa=Yes"), jobs: a.jobs, total: a.total },
    { search: search(2, "Remote", "remote=1"), jobs: b.jobs, total: b.total },
  ]);
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
