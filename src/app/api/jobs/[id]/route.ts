import { NextResponse } from "next/server";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getDescription } from "@/lib/details";
import type { Company } from "@/lib/companies";
import type { Ats } from "@/lib/types";

export const dynamic = "force-dynamic";

const { jobs } = schema;

/** One job with its full description (fetched from the ATS) and more open roles at the same company. */
export async function GET(_req: Request, { params }: RouteContext<"/api/jobs/[id]">) {
  const { id } = await params;
  const db = await getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  // Unknown or already-closed jobs are gone for good (410), so shared links never show a dead posting.
  if (!job || job.closed_at) return NextResponse.json({ gone: true }, { status: 410 });

  const [company] = await db
    .select({ board: schema.companies.board })
    .from(schema.companies)
    .where(and(eq(schema.companies.ats, job.ats), eq(schema.companies.slug, job.company_slug)));
  const [description, more] = await Promise.all([
    getDescription(
      { ats: job.ats as Ats, slug: job.company_slug, name: job.company_name, board: (company?.board ?? undefined) as Company["board"] },
      job.ats_job_id,
    ),
    db
      .select({ id: jobs.id, title: jobs.title, location: jobs.location, first_seen_at: jobs.first_seen_at })
      .from(jobs)
      .where(and(eq(jobs.ats, job.ats), eq(jobs.company_slug, job.company_slug), isNull(jobs.closed_at), ne(jobs.id, id)))
      .orderBy(desc(jobs.first_seen_at))
      .limit(6),
  ]);

  // The company took it down since our last crawl: remove it now instead of waiting for the next crawl.
  if (description.gone) {
    await db.update(jobs).set({ closed_at: new Date() }).where(eq(jobs.id, id));
    return NextResponse.json({ gone: true }, { status: 410 });
  }

  const rest: Partial<typeof job> = { ...job };
  delete rest.ats_job_id;
  delete rest.last_seen_at;
  return NextResponse.json({ job: rest, description: description.detail?.html ?? null, more }, { headers: { "cache-control": "private, max-age=60" } });
}
