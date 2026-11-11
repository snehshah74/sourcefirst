import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** "Not interested": hide a job from this user's feed and alerts. Body: { jobId } */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId || jobId.length > 200) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  const db = await getDb();
  await db.insert(schema.hiddenJobs).values({ userId: user.id, jobId }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
}

/** Undo: ?jobId=… */
export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  const db = await getDb();
  await db.delete(schema.hiddenJobs).where(and(eq(schema.hiddenJobs.userId, user.id), eq(schema.hiddenJobs.jobId, jobId)));
  return NextResponse.json({ ok: true });
}
