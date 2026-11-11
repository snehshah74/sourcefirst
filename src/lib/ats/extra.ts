import type { Company } from "../companies";
import type { Provider } from "./provider";
import { enc, withCountry } from "./provider";
import { FetchError, findInBoard, getJson, gone, htmlToText, paginate } from "./http";

const DAY = 86_400_000;

function board(c: Company): { host: string; site: string } {
  const b = c.board as { host?: string; site?: string } | undefined;
  if (!b?.host || !b?.site) throw new FetchError(`missing board settings for ${c.ats}/${c.slug}`);
  return { host: b.host, site: b.site };
}

function money(min?: number | null, max?: number | null, currency?: string | null, period?: string | null): string | null {
  if (!min && !max) return null;
  const per = /hour/i.test(period ?? "") ? " per hour" : /month/i.test(period ?? "") ? " per month" : " per year";
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
  return `${currency ?? "USD"} ${fmt(min ?? max!)}${max && max !== min ? `–${fmt(max)}` : ""}${per}`;
}

// ───────── Workday ─────────
// List: POST {host}/wday/cxs/{tenant}/{site}/jobs, 20 per page, newest first, at most 2,000.
interface WdListItem { title: string; externalPath: string; locationsText?: string; postedOn?: string }
interface WdDetail {
  jobPostingInfo?: {
    jobDescription?: string; location?: string; timeType?: string; remoteType?: string;
    country?: { descriptor?: string }; additionalLocations?: string[]; externalUrl?: string; startDate?: string;
  };
}

/** "Posted Today" / "Posted Yesterday" / "Posted 3 Days Ago" / "Posted 30+ Days Ago" → approximate date. */
function workdayPosted(s?: string): string | null {
  if (!s) return null;
  if (/today/i.test(s)) return new Date().toISOString();
  if (/yesterday/i.test(s)) return new Date(Date.now() - DAY).toISOString();
  const m = s.match(/(\d+)\+?\s*days?/i);
  return m ? new Date(Date.now() - Number(m[1]) * DAY).toISOString() : null;
}

export const workday: Provider = {
  label: "Workday",
  descriptionsInList: false,
  boardUrl: (c) => `https://${board(c).host}/${board(c).site}`,
  async list(c, opts) {
    const { host, site } = board(c);
    const tenant = host.split(".")[0];
    const { items, complete, total } = await paginate(
      async (offset) => {
        const d = await getJson<{ total?: number; jobPostings?: WdListItem[] }>(`https://${host}/wday/cxs/${tenant}/${site}/jobs`, 3, {
          method: "POST",
          body: { limit: 20, offset, searchText: "", appliedFacets: {} },
        });
        if (!Array.isArray(d.jobPostings)) throw new FetchError("unexpected response shape");
        return { items: d.jobPostings, total: d.total ?? 0 };
      },
      (j) => j.externalPath,
      opts,
    );
    return {
      complete,
      total,
      jobs: items.filter((j) => j.title && j.externalPath).map((j) => ({
        ats: "workday" as const,
        atsJobId: j.externalPath,
        companySlug: c.slug,
        companyName: c.name,
        title: j.title.trim(),
        location: j.locationsText?.trim() || "Unspecified", // "2 Locations" until the detail fills it in
        department: null,
        employmentType: null,
        isRemote: /remote/i.test(j.locationsText ?? "") || null,
        url: `https://${host}/${site}${j.externalPath}`,
        applyUrl: `https://${host}/${site}${j.externalPath}/apply`,
        publishedAt: workdayPosted(j.postedOn),
        descriptionText: "",
        salary: null,
      })),
    };
  },
  async detail(c, id) {
    const { host, site } = board(c);
    const d = await getJson<WdDetail>(`https://${host}/wday/cxs/${host.split(".")[0]}/${site}${id}`, 2);
    const i = d.jobPostingInfo;
    if (!i) throw gone();
    const places = [i.location, ...(i.additionalLocations ?? [])].filter(Boolean).join("; ");
    return {
      html: i.jobDescription ?? null,
      location: withCountry(places, i.country?.descriptor),
      remote: /remote/i.test(`${i.remoteType ?? ""} ${places}`),
      employmentType: i.timeType,
    };
  },
};

// ───────── SmartRecruiters ─────────
interface SrPosting {
  id: string; name: string; releasedDate?: string;
  location?: { city?: string; region?: string; country?: string; fullLocation?: string; remote?: boolean };
  department?: { label?: string }; typeOfEmployment?: { label?: string }; function?: { label?: string };
}
interface SrDetail {
  active?: boolean; postingUrl?: string; applyUrl?: string;
  jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
}

export const smartrecruiters: Provider = {
  label: "SmartRecruiters",
  descriptionsInList: false,
  boardUrl: (c) => `https://careers.smartrecruiters.com/${c.slug}`,
  async list(c, opts) {
    const { items, complete, total } = await paginate(
      async (offset) => {
        const d = await getJson<{ totalFound?: number; content?: SrPosting[] }>(
          `https://api.smartrecruiters.com/v1/companies/${enc(c.slug)}/postings?limit=100&offset=${offset}`,
        );
        if (!Array.isArray(d.content)) throw new FetchError("unexpected response shape");
        return { items: d.content, total: d.totalFound ?? 0 };
      },
      (j) => j.id,
      opts,
    );
    // A company id that exists but has never posted looks like an empty board; a typo'd one too.
    return {
      complete,
      total,
      jobs: items.filter((j) => j.id && j.name).map((j) => ({
        ats: "smartrecruiters" as const,
        atsJobId: j.id,
        companySlug: c.slug,
        companyName: c.name,
        title: j.name.trim(),
        location: j.location?.fullLocation || [j.location?.city, j.location?.region, j.location?.country?.toUpperCase()].filter(Boolean).join(", ") || "Unspecified",
        department: j.department?.label ?? j.function?.label ?? null,
        employmentType: j.typeOfEmployment?.label ?? null,
        isRemote: j.location?.remote ?? null,
        url: `https://jobs.smartrecruiters.com/${c.slug}/${j.id}`,
        applyUrl: `https://jobs.smartrecruiters.com/${c.slug}/${j.id}`,
        publishedAt: j.releasedDate ?? null,
        descriptionText: "",
        salary: null,
      })),
    };
  },
  async detail(c, id) {
    const d = await getJson<SrDetail>(`https://api.smartrecruiters.com/v1/companies/${enc(c.slug)}/postings/${enc(id)}`, 2);
    if (d.active === false) throw gone();
    const sections = Object.values(d.jobAd?.sections ?? {}).filter((s) => s?.text);
    return { html: sections.map((s) => `${s.title ? `<h3>${s.title}</h3>` : ""}${s.text}`).join("") || null };
  },
};

// ───────── Workable ─────────
interface WkJob {
  title: string; shortcode: string; employment_type?: string; telecommuting?: boolean; department?: string;
  url: string; application_url?: string; published_on?: string; created_at?: string;
  city?: string; state?: string; country?: string; locations?: { city?: string; region?: string; country?: string }[];
  description?: string;
}
const workableBoard = (slug: string) => () =>
  getJson<{ name?: string; jobs?: WkJob[] }>(`https://apply.workable.com/api/v1/widget/accounts/${enc(slug)}?details=true`);

export const workable: Provider = {
  label: "Workable",
  descriptionsInList: true,
  boardUrl: (c) => `https://apply.workable.com/${c.slug}`,
  async list(c) {
    const d = await workableBoard(c.slug)();
    if (!Array.isArray(d.jobs)) throw new FetchError("unexpected response shape");
    return {
      complete: true,
      total: d.jobs.length,
      jobs: d.jobs.map((j) => {
        const locs = j.locations?.length ? j.locations : [{ city: j.city, region: j.state, country: j.country }];
        return {
          ats: "workable" as const,
          atsJobId: j.shortcode,
          companySlug: c.slug,
          companyName: c.name,
          title: j.title.trim(),
          location: locs.map((l) => [l.city, l.region, l.country].filter(Boolean).join(", ")).filter(Boolean).join("; ") || "Unspecified",
          department: j.department || null,
          employmentType: j.employment_type || null,
          isRemote: j.telecommuting ?? null,
          url: j.url,
          applyUrl: j.application_url ?? j.url,
          publishedAt: j.published_on ?? j.created_at ?? null,
          descriptionText: htmlToText(j.description),
          salary: null,
        };
      }),
    };
  },
  async detail(c, id) {
    const j = await findInBoard(`workable:${c.slug}`, workableBoard(c.slug), (b) => b.jobs?.find((x) => x.shortcode === id));
    return { html: j.description ?? null };
  },
};

// ───────── Rippling ─────────
interface RpItem { id: string; name: string; url: string; department?: { name?: string }; locations?: { name?: string; country?: string; workplaceType?: string }[] }
interface RpDetail {
  description?: { company?: string; role?: string };
  workLocations?: string[];
  employmentType?: { id?: string };
  payRangeDetails?: { currency?: string; frequency?: string; rangeStart?: number; rangeEnd?: number }[];
}

export const rippling: Provider = {
  label: "Rippling",
  descriptionsInList: false,
  boardUrl: (c) => `https://ats.rippling.com/${c.slug}/jobs`,
  async list(c, opts) {
    // Not ordered by date, so always read every page (boards are small).
    const { items, complete, total } = await paginate(
      async (offset) => {
        const d = await getJson<{ items?: RpItem[]; totalItems?: number }>(
          `https://ats.rippling.com/api/v2/board/${enc(c.slug)}/jobs?page=${Math.floor(offset / 100)}&pageSize=100`,
        );
        if (!Array.isArray(d.items)) throw new FetchError("unexpected response shape");
        return { items: d.items, total: d.totalItems ?? 0 };
      },
      (j) => j.id,
      { full: true, limit: opts.limit },
    );
    // Rippling repeats a job once per location: merge those into one job with all its locations.
    const merged = new Map<string, RpItem>();
    for (const j of items) {
      const prev = merged.get(j.id);
      merged.set(j.id, prev ? { ...prev, locations: [...(prev.locations ?? []), ...(j.locations ?? [])] } : j);
    }
    return {
      complete,
      total: merged.size,
      jobs: [...merged.values()].map((j) => {
        const locs = (j.locations ?? []).filter((l, i, all) => all.findIndex((x) => x.name === l.name) === i);
        return {
          ats: "rippling" as const,
          atsJobId: j.id,
          companySlug: c.slug,
          companyName: c.name,
          title: j.name.trim(),
          location: locs.map((l) => withCountry(l.name, l.country)).join("; ") || "Unspecified",
          department: j.department?.name ?? null,
          employmentType: null,
          isRemote: locs.length ? locs.some((l) => l.workplaceType === "REMOTE") : null,
          url: j.url,
          applyUrl: j.url,
          publishedAt: null, // only in the detail (createdOn)
          descriptionText: "",
          salary: null,
        };
      }),
    };
  },
  async detail(c, id) {
    const d = await getJson<RpDetail>(`https://ats.rippling.com/api/v2/board/${enc(c.slug)}/jobs/${enc(id)}`, 2);
    const pay = d.payRangeDetails?.[0];
    return {
      html: [d.description?.role, d.description?.company].filter(Boolean).join("") || null,
      salary: pay ? money(pay.rangeStart, pay.rangeEnd, pay.currency, pay.frequency) : null,
      employmentType: d.employmentType?.id,
    };
  },
};

// ───────── Recruitee ─────────
interface RcOffer {
  id: number; title: string; careers_url: string; careers_apply_url?: string; published_at?: string; created_at?: string;
  location?: string; city?: string; country?: string; remote?: boolean; department?: string; employment_type_code?: string;
  description?: string; requirements?: string; salary?: { min?: string | number | null; max?: string | number | null; currency?: string | null; period?: string | null };
  status?: string;
}
const recruiteeBoard = (slug: string) => () => getJson<{ offers?: RcOffer[] }>(`https://${slug}.recruitee.com/api/offers/`);
const rcDate = (s?: string) => (s ? new Date(s.replace(" UTC", "Z").replace(" ", "T")).toISOString() : null);

export const recruitee: Provider = {
  label: "Recruitee",
  descriptionsInList: true,
  boardUrl: (c) => `https://${c.slug}.recruitee.com`,
  async list(c) {
    const d = await recruiteeBoard(c.slug)();
    if (!Array.isArray(d.offers)) throw new FetchError("unexpected response shape");
    return {
      complete: true,
      total: d.offers.length,
      jobs: d.offers.map((o) => ({
        ats: "recruitee" as const,
        atsJobId: String(o.id),
        companySlug: c.slug,
        companyName: c.name,
        title: o.title.trim(),
        location: withCountry(o.city || o.location, o.country),
        department: o.department || null,
        employmentType: o.employment_type_code ?? null,
        isRemote: o.remote ?? null,
        url: o.careers_url,
        applyUrl: o.careers_apply_url ?? o.careers_url,
        publishedAt: rcDate(o.published_at ?? o.created_at),
        descriptionText: htmlToText(`${o.description ?? ""}\n${o.requirements ?? ""}`),
        salary: money(Number(o.salary?.min) || null, Number(o.salary?.max) || null, o.salary?.currency, o.salary?.period),
      })),
    };
  },
  async detail(c, id) {
    const o = await findInBoard(`recruitee:${c.slug}`, recruiteeBoard(c.slug), (b) => b.offers?.find((x) => String(x.id) === id));
    return { html: `${o.description ?? ""}${o.requirements ?? ""}` || null };
  },
};

// ───────── Oracle Recruiting Cloud ─────────
interface OrReq {
  Id: string; Title: string; PostedDate?: string; PrimaryLocation?: string; PrimaryLocationCountry?: string;
  WorkplaceType?: string; JobFamily?: string; JobFunction?: string; ShortDescriptionStr?: string;
  secondaryLocations?: { Name?: string }[];
}
interface OrDetail {
  ExternalDescriptionStr?: string; ExternalResponsibilitiesStr?: string; ExternalQualificationsStr?: string; CorporateDescriptionStr?: string;
  JobSchedule?: string; PrimaryLocation?: string; WorkplaceType?: string;
}

export const oracle: Provider = {
  label: "Oracle Cloud",
  descriptionsInList: false,
  boardUrl: (c) => `https://${board(c).host}/hcmUI/CandidateExperience/en/sites/${board(c).site}`,
  async list(c, opts) {
    const { host, site } = board(c);
    const { items, complete, total } = await paginate(
      async (offset) => {
        const d = await getJson<{ items?: { TotalJobsCount?: number; requisitionList?: OrReq[] }[] }>(
          `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations` +
            `&finder=findReqs;siteNumber=${enc(site)},limit=200,offset=${offset},sortBy=POSTING_DATES_DESC`,
        );
        const page = d.items?.[0];
        if (!page || !Array.isArray(page.requisitionList)) throw new FetchError("unexpected response shape");
        return { items: page.requisitionList, total: page.TotalJobsCount ?? 0 };
      },
      (j) => j.Id,
      opts,
    );
    return {
      complete,
      total,
      jobs: items.filter((j) => j.Id && j.Title).map((j) => ({
        ats: "oracle" as const,
        atsJobId: j.Id,
        companySlug: c.slug,
        companyName: c.name,
        title: j.Title.trim(),
        location: [j.PrimaryLocation, ...(j.secondaryLocations ?? []).map((l) => l.Name)].filter(Boolean).join("; ") || "Unspecified",
        department: j.JobFamily || j.JobFunction || null,
        employmentType: null,
        isRemote: j.WorkplaceType ? /remote/i.test(j.WorkplaceType) : null,
        url: `https://${host}/hcmUI/CandidateExperience/en/sites/${site}/job/${j.Id}`,
        applyUrl: `https://${host}/hcmUI/CandidateExperience/en/sites/${site}/job/${j.Id}`,
        publishedAt: j.PostedDate ? new Date(`${j.PostedDate}T12:00:00Z`).toISOString() : null,
        descriptionText: htmlToText(j.ShortDescriptionStr),
        salary: null,
      })),
    };
  },
  async detail(c, id) {
    const { host, site } = board(c);
    const d = await getJson<{ items?: OrDetail[] }>(
      `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true` +
        `&finder=ById;Id=%22${enc(id)}%22,siteNumber=${enc(site)}`,
      2,
    );
    const r = d.items?.[0];
    if (!r) throw gone();
    return {
      html: [r.ExternalDescriptionStr, r.ExternalResponsibilitiesStr, r.ExternalQualificationsStr].filter(Boolean).join("") || null,
      employmentType: r.JobSchedule,
      remote: r.WorkplaceType ? /remote/i.test(r.WorkplaceType) : undefined,
    };
  },
};
