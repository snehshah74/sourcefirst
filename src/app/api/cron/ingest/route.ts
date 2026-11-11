import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Called every 15 minutes by a scheduler: Vercel Cron (vercel.json), GitHub Actions
 * (.github/workflows/crawl.yml), or any uptime/cron service. Requires `Authorization: Bearer $CRON_SECRET`.
 * In local dev with no CRON_SECRET set, it's open so you can trigger it by hand.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const devOpen = !secret && process.env.NODE_ENV !== "production";
  if (!devOpen && (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const trigger = req.headers.get("user-agent")?.includes("vercel-cron") ? "vercel-cron" : req.nextUrl.searchParams.get("trigger") ?? "http";
  return NextResponse.json(await runPipeline(trigger));
}
export const POST = GET;
