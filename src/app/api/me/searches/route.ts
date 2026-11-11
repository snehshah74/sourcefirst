import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { currentUser } from "@/lib/auth";
import { canonicalQuery } from "@/lib/query";

export const dynamic = "force-dynamic";

const { savedSearches } = schema;

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const db = await getDb();
  const items = await db.select().from(savedSearches).where(eq(savedSearches.userId, user.id)).orderBy(desc(savedSearches.createdAt));
  return NextResponse.json({ items });
}

/** Body: { name, query, alertsEnabled? } where query is a URL query string of job filters. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: string; query?: string; alertsEnabled?: boolean; frequency?: string };
  const frequency = body.frequency === "instant" ? "instant" : "daily";
  const query = canonicalQuery(new URLSearchParams(body.query ?? ""));
  const name = (body.name ?? "").trim().slice(0, 80) || "My search";
  const db = await getDb();
  const [row] = await db
    .insert(savedSearches)
    .values({ userId: user.id, name, query, alertsEnabled: body.alertsEnabled ?? true, frequency })
    .onConflictDoUpdate({ target: [savedSearches.userId, savedSearches.query], set: { name, alertsEnabled: body.alertsEnabled ?? true, frequency } })
    .returning();
  return NextResponse.json({ item: row });
}

/** Body: { id, alertsEnabled?, name? } */
export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: number; alertsEnabled?: boolean; name?: string; frequency?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = await getDb();
  const set: Partial<typeof savedSearches.$inferInsert> = {};
  if (body.alertsEnabled !== undefined) {
    set.alertsEnabled = body.alertsEnabled;
    if (body.alertsEnabled) set.lastAlertedAt = new Date(); // don't backfill everything missed while off
  }
  if (body.name) set.name = body.name.trim().slice(0, 80);
  if (body.frequency === "instant" || body.frequency === "daily") set.frequency = body.frequency;
  const [row] = await db.update(savedSearches).set(set).where(and(eq(savedSearches.id, body.id), eq(savedSearches.userId, user.id))).returning();
  return row ? NextResponse.json({ item: row }) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  const db = await getDb();
  await db.delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, user.id)));
  return NextResponse.json({ ok: true });
}
