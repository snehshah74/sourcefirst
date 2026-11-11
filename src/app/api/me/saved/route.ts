import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUSES = ["Saved", "Applied", "Interviewing", "Offer", "Rejected"];
const { savedJobs, jobs } = schema;

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const db = await getDb();
  const rows = await db.select().from(savedJobs).where(eq(savedJobs.userId, user.id)).orderBy(desc(savedJobs.updatedAt));
  return NextResponse.json({ items: rows });
}

/** Body: { jobId, status?, notes? }. Creates or updates the tracker entry. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { jobId?: string; status?: string; notes?: string };
  if (!body.jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  if (body.status && !STATUSES.includes(body.status)) return NextResponse.json({ error: "bad status" }, { status: 400 });

  const db = await getDb();
  // Snapshot comes from our own jobs table, never from the client.
  const [job] = await db.select().from(jobs).where(eq(jobs.id, body.jobId));
  const [existing] = await db.select().from(savedJobs).where(and(eq(savedJobs.userId, user.id), eq(savedJobs.jobId, body.jobId)));
  if (!job && !existing) return NextResponse.json({ error: "job not found" }, { status: 404 });

  const now = new Date();
  const [row] = await db
    .insert(savedJobs)
    .values({ userId: user.id, jobId: body.jobId, status: body.status ?? "Saved", notes: (body.notes ?? "").slice(0, 5000), job: job ?? existing!.job })
    .onConflictDoUpdate({
      target: [savedJobs.userId, savedJobs.jobId],
      set: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes.slice(0, 5000) } : {}),
        updatedAt: now,
      },
    })
    .returning();
  return NextResponse.json({ item: row });
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  const db = await getDb();
  await db.delete(savedJobs).where(and(eq(savedJobs.userId, user.id), eq(savedJobs.jobId, jobId)));
  return NextResponse.json({ ok: true });
}
