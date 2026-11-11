import type { MetadataRoute } from "next";
import { LANDINGS } from "@/lib/seo";
import { allCompanies } from "@/lib/query";

const BASE = process.env.SITE_URL ?? "http://localhost:3000";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const companies = await allCompanies().catch(() => []);
  return [
    { url: BASE, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/companies`, changeFrequency: "daily", priority: 0.7 },
    ...LANDINGS.map((l) => ({ url: `${BASE}/jobs/${l.slug}`, changeFrequency: "hourly" as const, priority: 0.8 })),
    ...companies.map((c) => ({ url: `${BASE}/companies/${c.slug}`, changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
