import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { currentUser } from "@/lib/auth";
import { cleanPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ prefs: null });
  const db = await getDb();
  const [row] = await db.select().from(schema.userPrefs).where(eq(schema.userPrefs.userId, user.id));
  return NextResponse.json({ prefs: row?.prefs ?? null });
}

export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const prefs = cleanPrefs(await req.json().catch(() => ({})));
  const db = await getDb();
  await db
    .insert(schema.userPrefs)
    .values({ userId: user.id, prefs, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.userPrefs.userId, set: { prefs, updatedAt: new Date() } });
  return NextResponse.json({ prefs });
}
