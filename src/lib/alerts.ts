import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { esc, sendEmail } from "./email";
import { parseFilters, searchJobs } from "./query";
import type { JobRow } from "./types";

const SITE = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const MAX_PER_SEARCH = 10;
const DIGEST_EVERY_MS = 23 * 3600_000; // "daily" = at most once per ~day, sent by the first crawl after that

type Search = typeof schema.savedSearches.$inferSelect;
interface Section {
  search: Search;
  jobs: JobRow[];
  total: number;
}

/**
 * Emails each user the jobs discovered since their last alert, one email per user covering all due searches.
 * "instant" searches are due every crawl; "daily" ones once a day (keeps free email quotas safe).
 */
export async function sendAlerts(now = new Date()): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ s: schema.savedSearches, email: schema.user.email, name: schema.user.name })
    .from(schema.savedSearches)
    .innerJoin(schema.user, eq(schema.user.id, schema.savedSearches.userId))
    .where(eq(schema.savedSearches.alertsEnabled, true));

  const due = rows.filter(({ s }) => s.frequency === "instant" || now.getTime() - s.lastAlertedAt.getTime() >= DIGEST_EVERY_MS);
  const byUser = new Map<string, { email: string; name: string; sections: Section[] }>();

  for (const { s, email, name } of due) {
    const found = await searchJobs({
      ...parseFilters(new URLSearchParams(s.query)),
      discoveredAfter: s.lastAlertedAt,
      hiddenFor: s.userId,
      pageSize: MAX_PER_SEARCH,
    });
    if (!found.total) continue;
    const entry = byUser.get(s.userId) ?? { email, name, sections: [] };
    entry.sections.push({ search: s, jobs: found.jobs, total: found.total });
    byUser.set(s.userId, entry);
  }

  let sent = 0;
  for (const [userId, u] of byUser) {
    const total = u.sections.reduce((n, x) => n + x.total, 0);
    const first = u.sections[0];
    const subject =
      u.sections.length === 1
        ? `${total.toLocaleString("en-US")} new ${total === 1 ? "job" : "jobs"}: ${first.search.name}`
        : `${total.toLocaleString("en-US")} new jobs across ${u.sections.length} alerts`;
    try {
      await sendEmail({
        to: u.email,
        subject,
        text: renderText(u.sections),
        html: renderHtml(u.name, total, u.sections),
        headers: { "List-Unsubscribe": `<${SITE}/account>` },
      });
      sent++;
      await db
        .update(schema.savedSearches)
        .set({ lastAlertedAt: now })
        .where(and(eq(schema.savedSearches.userId, userId), inArray(schema.savedSearches.id, u.sections.map((x) => x.search.id))));
    } catch (e) {
      console.error(`[alerts] failed for ${u.email}:`, (e as Error).message); // lastAlertedAt didn't move, so it retries next run
    }
  }

  // Searches that were due but had nothing new still advance, so the next digest covers only fresh jobs.
  const quiet = due.filter(({ s }) => !byUser.get(s.userId)?.sections.some((x) => x.search.id === s.id)).map(({ s }) => s.id);
  if (quiet.length) await db.update(schema.savedSearches).set({ lastAlertedAt: now }).where(inArray(schema.savedSearches.id, quiet));

  return sent;
}

// ───────────────────────── Email templates ─────────────────────────

function renderText(sections: Section[]) {
  const body = sections
    .map((x) => `${x.search.name} (${x.total} new)\n` + x.jobs.map((j) => `  • ${j.title} at ${j.company_name}, ${j.location}\n    ${SITE}/?job=${encodeURIComponent(j.id)}`).join("\n"))
    .join("\n\n");
  return `${body}\n\nManage or pause alerts: ${SITE}/account`;
}

const C = { ink: "#111214", muted: "#5d626b", subtle: "#8a8f98", line: "#e7e7e3", bg: "#f4f4f2", accent: "#0b8a4d", accentSoft: "#e5f5ec", danger: "#c62f3c", dangerSoft: "#fdecee" };

function salaryShort(raw: string | null) {
  if (!raw) return null;
  const n = [...raw.replace(/,/g, "").matchAll(/(\d+(?:\.\d+)?)\s*([kK])?/g)].map((m) => parseFloat(m[1]) * (m[2] ? 1e3 : 1)).filter((v) => v > 0);
  if (!n.length) return null;
  const [lo, hi] = [Math.min(...n.slice(0, 2)), Math.max(...n.slice(0, 2))];
  if (hi < 1000) return `$${Math.round(lo)}–${Math.round(hi)}/hr`;
  return lo === hi ? `$${Math.round(lo / 1e3)}k` : `$${Math.round(lo / 1e3)}k–${Math.round(hi / 1e3)}k`;
}

const tag = (text: string, fg: string, bg: string) =>
  `<span style="display:inline-block;padding:2px 7px;margin:0 4px 4px 0;border-radius:6px;background:${bg};color:${fg};font-size:12px;font-weight:600">${esc(text)}</span>`;

function jobCard(j: JobRow) {
  const view = `${SITE}/?job=${encodeURIComponent(j.id)}`;
  const apply = j.apply_url ?? j.url;
  const salary = salaryShort(j.salary);
  const tags = [
    salary && tag(salary, C.ink, C.bg),
    j.remote && tag("Remote", "#2457c5", "#e8effc"),
    j.visa === "Yes" && tag("Sponsors visa", C.accent, C.accentSoft),
    j.visa === "No" && tag("No sponsorship", C.danger, C.dangerSoft),
    tag(j.seniority, C.muted, C.bg),
  ]
    .filter(Boolean)
    .join("");
  const logo = j.company_domain
    ? `<img src="${SITE}/api/logo?domain=${esc(j.company_domain)}" width="36" height="36" alt="" style="display:block;border:1px solid ${C.line};border-radius:9px;background:#fff;padding:3px">`
    : `<div style="width:36px;height:36px;border-radius:9px;background:${C.bg}"></div>`;
  return `
  <tr><td style="padding:14px 0;border-top:1px solid ${C.line}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="48" valign="top">${logo}</td>
      <td valign="top">
        <a href="${esc(view)}" style="color:${C.ink};font-size:15px;font-weight:600;text-decoration:none;line-height:1.35">${esc(j.title)}</a>
        <div style="color:${C.muted};font-size:13px;margin:2px 0 7px">${esc(j.company_name)} · ${esc(j.location.split(/[;|•]/)[0].trim())}</div>
        <div>${tags}</div>
      </td>
      <td width="84" valign="top" align="right">
        <a href="${esc(apply)}" style="display:inline-block;padding:7px 12px;border-radius:8px;background:${C.accent};color:#fff;font-size:13px;font-weight:600;text-decoration:none">Apply</a>
      </td>
    </tr></table>
  </td></tr>`;
}

export function renderHtml(name: string, total: number, sections: Section[]) {
  const first = name.split(" ")[0] || "there";
  const body = sections
    .map(
      (x) => `
      <tr><td style="padding:22px 0 4px">
        <div style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${C.subtle}">Alert</div>
        <div style="font-size:17px;font-weight:700;color:${C.ink};margin-top:2px">${esc(x.search.name)} <span style="color:${C.accent};font-weight:600">· ${x.total.toLocaleString("en-US")} new</span></div>
      </td></tr>
      ${x.jobs.map(jobCard).join("")}
      ${x.total > x.jobs.length ? `<tr><td style="padding:10px 0 4px;border-top:1px solid ${C.line}"><a href="${SITE}/?${esc(x.search.query)}" style="color:${C.accent};font-size:14px;font-weight:600;text-decoration:none">See all ${x.total.toLocaleString("en-US")} jobs →</a></td></tr>` : ""}`,
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden">${total} new ${total === 1 ? "job matches" : "jobs match"} your alerts. Apply while the applicant pool is small.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid ${C.line};border-radius:16px;padding:24px 24px 8px">
      <tr><td>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="width:26px;height:26px;border-radius:7px;background:${C.accent};color:#fff;font-weight:800;font-size:15px;text-align:center">↗</td>
          <td style="padding-left:8px;font-weight:700;font-size:16px;color:${C.ink}">Source<span style="color:${C.accent}">First</span></td>
        </tr></table>
        <h1 style="margin:20px 0 4px;font-size:22px;line-height:1.25;color:${C.ink}">Hi ${esc(first)}, ${total.toLocaleString("en-US")} new ${total === 1 ? "job" : "jobs"} for you</h1>
        <p style="margin:0;color:${C.muted};font-size:14px;line-height:1.5">Found on company career pages since your last alert. Early applicants get noticed, so don't wait too long.</p>
      </td></tr>
      ${body}
      <tr><td style="padding:22px 0 16px;border-top:1px solid ${C.line};color:${C.subtle};font-size:12px;line-height:1.6">
        You're getting this because you created job alerts on SourceFirst.<br>
        <a href="${SITE}/account" style="color:${C.muted}">Change frequency, pause or delete alerts</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
