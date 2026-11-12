import { NextResponse } from "next/server";
import { stats } from "@/lib/query";

export const dynamic = "force-dynamic";

export async function GET() {
  // Same for everyone, so the CDN can answer most visits without reaching the database.
  return NextResponse.json(await stats(), { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
