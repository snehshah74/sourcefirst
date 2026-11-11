export type Ats = "greenhouse" | "lever" | "ashby" | "workday" | "smartrecruiters" | "workable" | "rippling" | "recruitee" | "oracle";

export type Visa = "Yes" | "No" | "Maybe";

/** A job normalized from any ATS. Enrichment fields are added by enrich(). */
export interface RawJob {
  ats: Ats;
  atsJobId: string;
  companySlug: string;
  companyName: string;
  title: string;
  location: string;
  department: string | null;
  employmentType: string | null;
  isRemote: boolean | null;
  url: string;
  applyUrl: string | null;
  publishedAt: string | null; // ISO, as reported by the ATS
  descriptionText: string; // plain text, used for enrichment only
  salary: string | null;
}

export interface EnrichedJob extends RawJob {
  country: "USA" | "Non-USA" | "Unknown";
  remote: boolean;
  visa: Visa;
  minExp: number | null;
  category: string;
  seniority: string;
  salaryMin: number | null;
}

/** Row returned to the UI. */
export interface JobRow {
  id: string;
  ats: Ats;
  company_slug: string;
  company_name: string;
  company_domain: string | null;
  title: string;
  location: string;
  department: string | null;
  employment_type: string | null;
  remote: boolean;
  url: string;
  apply_url: string | null;
  published_at: string | Date | null;
  first_seen_at: string | Date; // Date on the server, ISO string after JSON
  country: string;
  visa: Visa;
  min_exp: number | null;
  category: string;
  seniority: string;
  salary: string | null;
}
