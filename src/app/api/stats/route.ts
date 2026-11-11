import { NextResponse } from "next/server";
import { stats } from "@/lib/query";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await stats());
}
