import type { Company } from "../companies";
import type { Ats } from "../types";
import type { JobDetail, ListOptions, ListResult, Provider } from "./provider";
import { ashby, greenhouse, lever } from "./core";
import { oracle, recruitee, rippling, smartrecruiters, workable, workday } from "./extra";

export { FetchError, decodeEntities, isGone } from "./http";
export type { JobDetail } from "./provider";

export const PROVIDERS: Record<Ats, Provider> = { greenhouse, lever, ashby, workday, smartrecruiters, workable, rippling, recruitee, oracle };

/** A board's open jobs. Throws FetchError (status 404 = the board itself is gone). */
export function fetchCompanyJobs(c: Company, opts: ListOptions = {}): Promise<ListResult> {
  return PROVIDERS[c.ats].list(c, opts);
}

/** One job's description and extra fields. Throws FetchError with status 404 when the job is gone. */
export function fetchJobDetail(c: Company, atsJobId: string): Promise<JobDetail> {
  return PROVIDERS[c.ats].detail(c, atsJobId);
}
