/** Programmatic SEO landing pages, one per common search. Add rows to add pages. */
export interface Landing {
  slug: string;
  h1: string;
  blurb: string;
  filters: Record<string, string>;
}

export const LANDINGS: Landing[] = [
  { slug: "visa-sponsorship-jobs", h1: "Jobs with visa sponsorship", blurb: "US roles whose descriptions say the employer sponsors visas (H-1B, O-1, TN and others), pulled straight from company career portals.", filters: { visa: "Yes" } },
  { slug: "greenhouse-jobs", h1: "Greenhouse jobs", blurb: "Every open role posted on Greenhouse job boards we track, refreshed every 15 minutes.", filters: { ats: "greenhouse" } },
  { slug: "lever-jobs", h1: "Lever jobs", blurb: "Open roles from companies hiring on Lever, refreshed every 15 minutes.", filters: { ats: "lever" } },
  { slug: "ashby-jobs", h1: "Ashby jobs", blurb: "Open roles from startups hiring on Ashby, refreshed every 15 minutes.", filters: { ats: "ashby" } },
  { slug: "remote-jobs", h1: "Remote jobs in the US", blurb: "Remote-friendly roles, straight from company career sites.", filters: { remote: "1" } },
  { slug: "software-engineer-jobs", h1: "Software engineer jobs", blurb: "Fresh software engineering roles from top tech companies, often listed before they reach LinkedIn.", filters: { category: "Engineering" } },
  { slug: "new-grad-and-intern-jobs", h1: "New grad and internship jobs", blurb: "Entry-level and internship roles, sorted by when they were posted.", filters: { seniority: "Intern,Entry" } },
  { slug: "ai-and-data-jobs", h1: "AI, ML and data jobs", blurb: "Machine learning, data science and analytics roles.", filters: { category: "Data & AI" } },
  { slug: "product-manager-jobs", h1: "Product manager jobs", blurb: "Product and program management roles at tech companies.", filters: { category: "Product" } },
  { slug: "jobs-posted-today", h1: "Jobs posted in the last 24 hours", blurb: "Everything we discovered in the last day. Apply while the applicant pool is still small.", filters: { since: "24" } },
];
