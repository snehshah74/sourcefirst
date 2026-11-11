import type { Provider } from "./provider";
import { enc } from "./provider";
import { decodeEntities, FetchError, findInBoard, getJson, htmlToText } from "./http";

// ───────── Greenhouse ─────────
interface GhJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  departments?: { name: string }[];
  first_published?: string;
  updated_at?: string;
  content?: string;
}

export const greenhouse: Provider = {
  label: "Greenhouse",
  descriptionsInList: true,
  boardUrl: (c) => `https://job-boards.greenhouse.io/${c.slug}`,
  async list(c) {
    const data = await getJson<{ jobs: GhJob[] }>(`https://boards-api.greenhouse.io/v1/boards/${enc(c.slug)}/jobs?content=true`);
    if (!Array.isArray(data?.jobs)) throw new FetchError("unexpected response shape");
    return {
      complete: true,
      total: data.jobs.length,
      jobs: data.jobs.map((j) => ({
        ats: "greenhouse",
        atsJobId: String(j.id),
        companySlug: c.slug,
        companyName: c.name,
        title: j.title.trim(),
        location: j.location?.name?.trim() || "Unspecified",
        department: j.departments?.[0]?.name ?? null,
        employmentType: null,
        isRemote: null,
        url: j.absolute_url,
        applyUrl: j.absolute_url,
        publishedAt: j.first_published ?? j.updated_at ?? null,
        descriptionText: htmlToText(j.content),
        salary: null,
      })),
    };
  },
  async detail(c, id) {
    const j = await getJson<{ content?: string }>(`https://boards-api.greenhouse.io/v1/boards/${enc(c.slug)}/jobs/${enc(id)}`, 2);
    return { html: j.content ? decodeEntities(j.content) : null };
  },
};

// ───────── Lever ─────────
interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  workplaceType?: string;
  categories?: { location?: string; team?: string; department?: string; commitment?: string; allLocations?: string[] };
  description?: string;
  descriptionPlain?: string;
  additional?: string;
  additionalPlain?: string;
  lists?: { text: string; content: string }[];
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

export const lever: Provider = {
  label: "Lever",
  descriptionsInList: true,
  boardUrl: (c) => `https://jobs.lever.co/${c.slug}`,
  async list(c) {
    const data = await getJson<LeverJob[]>(`https://api.lever.co/v0/postings/${enc(c.slug)}?mode=json`);
    if (!Array.isArray(data)) throw new FetchError("unexpected response shape");
    return {
      complete: true,
      total: data.length,
      jobs: data.map((j) => {
        const lists = (j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n");
        const sr = j.salaryRange;
        return {
          ats: "lever" as const,
          atsJobId: j.id,
          companySlug: c.slug,
          companyName: c.name,
          title: j.text.trim(),
          location: j.categories?.allLocations?.join("; ") || j.categories?.location || "Unspecified",
          department: j.categories?.department ?? j.categories?.team ?? null,
          employmentType: j.categories?.commitment ?? null,
          isRemote: j.workplaceType ? j.workplaceType === "remote" : null,
          url: j.hostedUrl,
          applyUrl: j.applyUrl ?? null,
          publishedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
          descriptionText: [j.descriptionPlain, lists, j.additionalPlain].filter(Boolean).join("\n").slice(0, 20_000),
          salary: sr?.min ? `${sr.currency ?? "USD"} ${sr.min.toLocaleString()}–${(sr.max ?? sr.min).toLocaleString()}${sr.interval ? ` ${sr.interval}` : ""}` : null,
        };
      }),
    };
  },
  async detail(c, id) {
    const j = await getJson<LeverJob>(`https://api.lever.co/v0/postings/${enc(c.slug)}/${enc(id)}?mode=json`, 2);
    const lists = (j.lists ?? []).map((l) => `<h3>${htmlToText(l.text)}</h3><ul>${l.content}</ul>`).join("");
    return { html: [j.description, lists, j.additional].filter(Boolean).join("") || null };
  },
};

// ───────── Ashby ─────────
interface AshbyJob {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: { location: string }[];
  isRemote?: boolean;
  workplaceType?: string;
  isListed?: boolean;
  publishedAt?: string;
  jobUrl: string;
  applyUrl?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
  compensation?: { compensationTierSummary?: string; scrapeableCompensationSalarySummary?: string };
}

const ashbyBoard = (slug: string) => () =>
  getJson<{ jobs: AshbyJob[] }>(`https://api.ashbyhq.com/posting-api/job-board/${enc(slug)}?includeCompensation=true`);

export const ashby: Provider = {
  label: "Ashby",
  descriptionsInList: true,
  boardUrl: (c) => `https://jobs.ashbyhq.com/${c.slug}`,
  async list(c) {
    const data = await ashbyBoard(c.slug)();
    if (!Array.isArray(data?.jobs)) throw new FetchError("unexpected response shape");
    return {
      complete: true,
      total: data.jobs.length,
      jobs: data.jobs
        .filter((j) => j.isListed !== false)
        .map((j) => ({
          ats: "ashby" as const,
          atsJobId: j.id,
          companySlug: c.slug,
          companyName: c.name,
          title: j.title.trim(),
          location: [j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)].filter(Boolean).join("; ") || "Unspecified",
          department: j.department ?? j.team ?? null,
          employmentType: j.employmentType ?? null,
          isRemote: j.isRemote ?? (j.workplaceType ? j.workplaceType === "Remote" : null),
          url: j.jobUrl,
          applyUrl: j.applyUrl ?? null,
          publishedAt: j.publishedAt ?? null,
          descriptionText: (j.descriptionPlain ?? "").slice(0, 20_000),
          salary: j.compensation?.scrapeableCompensationSalarySummary ?? j.compensation?.compensationTierSummary ?? null,
        })),
    };
  },
  async detail(c, id) {
    const j = await findInBoard(`ashby:${c.slug}`, ashbyBoard(c.slug), (b) => b.jobs?.find((x) => x.id === id));
    return { html: j.descriptionHtml ?? null };
  },
};
