import { NextRequest, NextResponse } from "next/server";
import { parseFilters, searchJobs } from "@/lib/query";
import { currentUser } from "@/lib/auth";
import { GUEST_LIMIT } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  const f = parseFilters(req.nextUrl.searchParams);
  // Signed-in users never see jobs they marked "not interested" (unless they're viewing hidden ones).
  if (user && req.nextUrl.searchParams.get("hidden") !== "1") f.hiddenFor = user.id;
  if (!user) Object.assign(f, { page: 1, pageSize: GUEST_LIMIT });
  return NextResponse.json(await searchJobs(f));
}
