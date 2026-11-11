import type { Company } from "../companies";
import type { RawJob } from "../types";

export interface ListOptions {
  /** Open job ids we already have for this board (lets paginated boards stop early). */
  known?: Set<string>;
  /** Read every page (needed to notice removed jobs). */
  full?: boolean;
  /** Stop after this many jobs (discovery only needs to know a board is alive). */
  limit?: number;
}

export interface ListResult {
  jobs: RawJob[];
  /** True when every open job on the board was read, so missing ones can safely be closed. */
  complete: boolean;
  /** Open jobs on the board as the ATS reports it (may exceed what was read). */
  total: number;
}

/** What opening one job adds beyond the list (description, plus fields some lists leave out). */
export interface JobDetail {
  html: string | null;
  location?: string;
  remote?: boolean;
  employmentType?: string;
  salary?: string | null;
}

export interface Provider {
  label: string;
  /** Whether list results already carry full descriptions (otherwise they're fetched job by job). */
  descriptionsInList: boolean;
  /** Public careers page for the board. */
  boardUrl(c: Company): string;
  /** All (or, incrementally, the newest) open jobs. Throws FetchError; status 404 = board is gone. */
  list(c: Company, opts: ListOptions): Promise<ListResult>;
  /** One job's details. Throws FetchError with status 404 when the job is gone. */
  detail(c: Company, atsJobId: string): Promise<JobDetail>;
}

export const enc = encodeURIComponent;

/** "San Francisco, CA" + "United States" → "San Francisco, CA, United States" (country helps the US filter). */
export function withCountry(place: string | null | undefined, country: string | null | undefined): string {
  const p = (place ?? "").trim();
  const c = (country ?? "").trim();
  if (!c || p.toLowerCase().includes(c.toLowerCase())) return p || c || "Unspecified";
  return p ? `${p}, ${c}` : c;
}
