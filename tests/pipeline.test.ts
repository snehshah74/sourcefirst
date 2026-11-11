// End-to-end test of the crawl pipeline against a throwaway embedded Postgres, with the ATS APIs faked.
// Run: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "sf-test-"));
delete process.env.DATABASE_URL;
delete process.env.RESEND_API_KEY;

// Fake ATS: the "figma" Greenhouse board returns whatever `board` holds; every other board is empty.
let board: { id: number; title: string; location: string }[] = [];
let figmaStatus = 200; // set to 404 to simulate the company deleting its board, 500 for an outage
globalThis.fetch = (async (input: string | URL) => {
  const url = String(input);
  if (url.includes("/boards/figma/") && figmaStatus !== 200) return new Response("{}", { status: figmaStatus });
  // Single-job lookups (descriptions): job 999 has been taken down, job 998's server is having trouble.
  if (url.includes("/boards/figma/jobs/999")) return new Response("{}", { status: 404 });
  if (url.includes("/boards/figma/jobs/998")) return new Response("{}", { status: 503 });
  const body = url.includes("boards-api.greenhouse.io/v1/boards/figma/")
    ? {
        jobs: board.map((j) => ({
          id: j.id,
          title: j.title,
          absolute_url: `https://boards.greenhouse.io/figma/jobs/${j.id}`,
          location: { name: j.location },
          departments: [{ name: "Engineering" }],
          first_published: "2026-11-01T00:00:00Z",
          content: "&lt;p&gt;We sponsor visas. 3+ years of experience.&lt;/p&gt;",
          metadata: [],
        })),
      }
    : emptyBoard(url);
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

/** An empty job board, in each ATS's own response format. */
function emptyBoard(url: string): unknown {
  if (url.includes("api.lever.co")) return [];
  if (url.includes("myworkdayjobs.com")) return { total: 0, jobPostings: [] };
  if (url.includes("api.smartrecruiters.com")) return { totalFound: 0, content: [] };
  if (url.includes("ats.rippling.com/api/v2/board/dupe-test/jobs?"))
    // Rippling lists one job once per location
    return {
      totalItems: 3,
      items: [
        { id: "a", name: "Engineer", url: "https://ats.rippling.com/dupe-test/jobs/a", locations: [{ name: "New York, NY", country: "United States" }] },
        { id: "a", name: "Engineer", url: "https://ats.rippling.com/dupe-test/jobs/a", locations: [{ name: "Austin, TX", country: "United States" }] },
        { id: "b", name: "Designer", url: "https://ats.rippling.com/dupe-test/jobs/b", locations: [{ name: "Remote", country: "United States", workplaceType: "REMOTE" }] },
      ],
    };
  if (url.includes("ats.rippling.com")) return { totalItems: 0, items: [] };
  if (url.includes("recruitee.com")) return { offers: [] };
  if (url.includes("oraclecloud.com")) return { items: [{ TotalJobsCount: 0, requisitionList: [] }] };
  return { jobs: [] }; // Greenhouse, Ashby, Workable
}

// Capture "sent" emails (dev mode logs them).
const emails: string[] = [];
const origLog = console.log;
console.log = (...a: unknown[]) => {
  const s = a.map(String).join(" ");
  if (s.includes("[email:dev]")) emails.push(s);
  else if (!s.startsWith("[pipeline]")) origLog(...a);
};

const { getDb, schema } = await import("../src/db");
const { runPipeline } = await import("../src/lib/pipeline");
const { eq } = await import("drizzle-orm");

before(async () => {
  const db = await getDb();
  await db.insert(schema.user).values({ id: "u1", name: "Tess", email: "tess@example.com" });
  await db.insert(schema.savedSearches).values({ userId: "u1", name: "Figma eng", query: "company=figma", frequency: "instant", lastAlertedAt: new Date(Date.now() - 1000) });
  // A daily digest that was just sent: must NOT fire again within the day.
  await db.insert(schema.savedSearches).values({ userId: "u1", name: "Daily figma", query: "company=figma&us=0", frequency: "daily", lastAlertedAt: new Date(Date.now() - 1000) });
});

const openFigma = async () => {
  const db = await getDb();
  const rows = await db.select().from(schema.jobs).where(eq(schema.jobs.company_slug, "figma"));
  return rows.filter((r) => !r.closed_at).map((r) => r.ats_job_id).sort();
};

test("first crawl imports the backlog without counting it as new or alerting", async () => {
  board = [
    { id: 1, title: "Software Engineer", location: "San Francisco, CA" },
    { id: 2, title: "Product Designer", location: "New York, NY" },
  ];
  const r = await runPipeline("test");
  assert.equal(r.companiesFailed.length, 0);
  assert.equal(r.newJobs, 0);
  assert.equal(r.alertsSent, 0);
  assert.deepEqual(await openFigma(), ["1", "2"]);
});

test("a job that appears later is new, enriched, and triggers one alert email", async () => {
  board.push({ id: 3, title: "Senior ML Engineer", location: "Remote - US" });
  const r = await runPipeline("test");
  assert.equal(r.newJobs, 1);
  assert.equal(r.alertsSent, 1);
  assert.equal(emails.length, 1);
  assert.match(emails[0], /tess@example\.com/);
  assert.match(emails[0], /Senior ML Engineer/);

  const db = await getDb();
  const [j] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, "greenhouse:3"));
  assert.equal(j.visa, "Yes");
  assert.equal(j.min_exp, 3);
  assert.equal(j.country, "USA");
  assert.equal(j.remote, true);
});

test("no new jobs means no repeat alert", async () => {
  const r = await runPipeline("test");
  assert.equal(r.newJobs, 0);
  assert.equal(r.alertsSent, 0);
});

test("a job removed from the board is closed", async () => {
  board = board.filter((j) => j.id !== 2);
  const r = await runPipeline("test");
  assert.equal(r.closedJobs, 1);
  assert.deepEqual(await openFigma(), ["1", "3"]);
});

test("a board that suddenly returns nothing is treated as a glitch, then closed after 3 empty crawls", async () => {
  board = [];
  for (let i = 1; i <= 2; i++) {
    const r = await runPipeline("test");
    assert.equal(r.closedJobs, 0, `empty crawl ${i} should not close jobs`);
    assert.deepEqual(await openFigma(), ["1", "3"]);
  }
  const r = await runPipeline("test");
  assert.equal(r.closedJobs, 2);
  assert.deepEqual(await openFigma(), []);
});

test("a job that comes back is reopened", async () => {
  board = [{ id: 1, title: "Software Engineer", location: "San Francisco, CA" }];
  await runPipeline("test");
  assert.deepEqual(await openFigma(), ["1"]);
});

test("daily digest waits a day, then includes everything new since the last one", async () => {
  const db = await getDb();
  const { sendAlerts } = await import("../src/lib/alerts");
  // Not due yet (sent <23h ago)
  emails.length = 0;
  board.push({ id: 4, title: "Data Engineer", location: "Austin, TX" });
  await runPipeline("test");
  assert.equal(emails.filter((e) => e.includes("Daily figma")).length, 0);
  // Pretend the last digest went out yesterday: now it's due and lists the new job.
  await db.update(schema.savedSearches).set({ lastAlertedAt: new Date(Date.now() - 25 * 3600_000) }).where(eq(schema.savedSearches.name, "Daily figma"));
  emails.length = 0;
  const sent = await sendAlerts();
  assert.equal(sent, 1);
  assert.match(emails[0], /Data Engineer/);
});

test("jobs a user hid never appear in their alerts", async () => {
  const db = await getDb();
  await db.insert(schema.hiddenJobs).values({ userId: "u1", jobId: "greenhouse:5" });
  board.push({ id: 5, title: "Hidden Role", location: "Austin, TX" });
  emails.length = 0;
  await runPipeline("test");
  assert.ok(!emails.some((e) => e.includes("Hidden Role")), "hidden job must not be emailed");
});

test("salary parsing for sorting", async () => {
  const { parseSalaryMin } = await import("../src/lib/enrich");
  assert.equal(parseSalaryMin("USD 177,000–266,000 per-year-salary"), 177000);
  assert.equal(parseSalaryMin("$150K – $200K"), 150000);
  assert.equal(parseSalaryMin("$45 – $60 per hour"), 93600);
  assert.equal(parseSalaryMin("Competitive"), null);
});

test("closed jobs older than the retention window are pruned", async () => {
  const db = await getDb();
  await db.update(schema.jobs).set({ closed_at: new Date(Date.now() - 30 * 86400_000) }).where(eq(schema.jobs.id, "greenhouse:2"));
  const r = await runPipeline("test");
  assert.ok(r.pruned >= 1);
  const [gone] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, "greenhouse:2"));
  assert.equal(gone, undefined);
});

test("a board that returns 'not found' has its jobs removed on that same crawl", async () => {
  board = [{ id: 1, title: "Software Engineer", location: "San Francisco, CA" }, { id: 6, title: "Designer", location: "Austin, TX" }];
  await runPipeline("test");
  assert.deepEqual(await openFigma(), ["1", "6"]);

  figmaStatus = 404;
  const r = await runPipeline("test");
  assert.ok(r.closedJobs >= 2);
  assert.deepEqual(await openFigma(), [], "no job from a deleted board may stay listed");
});

test("if the board comes back, its jobs come back", async () => {
  figmaStatus = 200;
  await runPipeline("test");
  assert.deepEqual(await openFigma(), ["1", "6"]);
});

test("an outage (5xx) does not remove jobs", async () => {
  figmaStatus = 500;
  await runPipeline("test");
  assert.deepEqual(await openFigma(), ["1", "6"]);
  figmaStatus = 200;
  await runPipeline("test");
});

test("a board that is 'not found' 3 crawls in a row stops being crawled", async () => {
  const db = await getDb();
  figmaStatus = 404;
  for (let i = 0; i < 3; i++) await runPipeline("test");
  const [c] = await db.select().from(schema.companies).where(eq(schema.companies.slug, "figma"));
  assert.equal(c.enabled, false);
  assert.equal(c.open_jobs, 0);
  figmaStatus = 200;
});

test("a single posting the company took down is reported as gone; an outage is not", async () => {
  const { getDescription } = await import("../src/lib/details");
  const figma = { ats: "greenhouse" as const, slug: "figma", name: "Figma" };
  assert.deepEqual(await getDescription(figma, "999"), { detail: null, gone: true });
  assert.deepEqual(await getDescription(figma, "998"), { detail: null, gone: false });
});

test("a job listed once per location becomes one job with all its locations", async () => {
  const { fetchCompanyJobs } = await import("../src/lib/ats");
  const r = await fetchCompanyJobs({ ats: "rippling", slug: "dupe-test", name: "Dupe Co" }, {});
  assert.equal(r.jobs.length, 2);
  const eng = r.jobs.find((j) => j.atsJobId === "a")!;
  assert.equal(eng.location, "New York, NY, United States; Austin, TX, United States");
  assert.equal(r.jobs.find((j) => j.atsJobId === "b")!.isRemote, true);
});
