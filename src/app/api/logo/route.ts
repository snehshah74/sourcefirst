import { NextRequest, NextResponse } from "next/server";

// Company logo proxy, keyed by domain (/api/logo?domain=example.com). Cached for a week.
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain") ?? "";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return new NextResponse(null, { status: 400 });
  const res = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`);
  if (!res.ok) return new NextResponse(null, { status: 404 });
  return new NextResponse(res.body, {
    headers: { "content-type": res.headers.get("content-type") ?? "image/png", "cache-control": "public, max-age=604800, immutable" },
  });
}
