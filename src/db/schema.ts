import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// ───────────────────────── Crawl pipeline ─────────────────────────

export const companies = pgTable(
  "companies",
  {
    ats: text("ats").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    domain: text("domain"),
    /** Extra identifiers some ATSs need, e.g. Workday { host, site }, Oracle { host, site }. */
    board: jsonb("board"),
    enabled: boolean("enabled").notNull().default(true),
    first_crawled_at: ts("first_crawled_at"),
    last_ok_at: ts("last_ok_at"),
    last_error_at: ts("last_error_at"),
    last_error: text("last_error"),
    consecutive_failures: integer("consecutive_failures").notNull().default(0),
    consecutive_empty: integer("consecutive_empty").notNull().default(0),
    open_jobs: integer("open_jobs").notNull().default(0),
    /** Big paginated boards read only their newest pages most runs; a full pass (which can close jobs) runs hourly. */
    last_full_crawl_at: ts("last_full_crawl_at"),
  },
  (t) => [primaryKey({ columns: [t.ats, t.slug] })],
);

export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(), // "<ats>:<ats_job_id>"
    ats: text("ats").notNull(),
    ats_job_id: text("ats_job_id").notNull(),
    company_slug: text("company_slug").notNull(),
    company_name: text("company_name").notNull(),
    company_domain: text("company_domain"),
    title: text("title").notNull(),
    location: text("location").notNull(),
    department: text("department"),
    employment_type: text("employment_type"),
    remote: boolean("remote").notNull().default(false),
    url: text("url").notNull(),
    apply_url: text("apply_url"),
    published_at: ts("published_at"),
    first_seen_at: ts("first_seen_at").notNull(), // when WE first saw it: the freshness signal
    last_seen_at: ts("last_seen_at").notNull(),
    closed_at: ts("closed_at"), // set when it disappears from the company's board
    country: text("country").notNull(),
    visa: text("visa").notNull(),
    min_exp: integer("min_exp"),
    category: text("category").notNull(),
    seniority: text("seniority").notNull(),
    salary: text("salary"),
    salary_min: integer("salary_min"), // yearly, parsed from `salary`, for sorting
    /** True once the full description has been read (some ATS lists don't include it). */
    desc_checked: boolean("desc_checked").notNull().default(false),
    /** Countries and regions from the location, for the country filter. */
    places: text("places").array().notNull().default(sql`'{}'::text[]`),
    /** Tools and languages from the description; null until the description has been read. */
    skills: text("skills").array(),
  },
  (t) => [
    index("jobs_open_seen").on(t.first_seen_at.desc()).where(sql`${t.closed_at} is null`),
    index("jobs_company").on(t.ats, t.company_slug),
    index("jobs_places").using("gin", t.places),
    index("jobs_skills").using("gin", t.skills),
  ],
);

export const runs = pgTable("runs", {
  id: serial("id").primaryKey(),
  trigger: text("trigger").notNull().default("manual"),
  started_at: ts("started_at").notNull().defaultNow(),
  finished_at: ts("finished_at"),
  companies_ok: integer("companies_ok").notNull().default(0),
  companies_failed: integer("companies_failed").notNull().default(0),
  new_jobs: integer("new_jobs").notNull().default(0),
  closed_jobs: integer("closed_jobs").notNull().default(0),
  alerts_sent: integer("alerts_sent").notNull().default(0),
  error: text("error"),
});

// ───────────────────────── Auth (Better Auth core tables) ─────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: ts("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// ───────────────────────── Per-user data ─────────────────────────

/** Saved jobs + application tracker. `job` is a snapshot so it survives the posting closing. */
export const savedJobs = pgTable(
  "saved_jobs",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id").notNull(),
    status: text("status").notNull().default("Saved"),
    notes: text("notes").notNull().default(""),
    job: jsonb("job").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.jobId] })],
);

/** A filter set the user wants emailed when new matching jobs are discovered. */
export const savedSearches = pgTable(
  "saved_searches",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    query: text("query").notNull(), // URLSearchParams string, same format as /api/jobs
    alertsEnabled: boolean("alerts_enabled").notNull().default(true),
    frequency: text("frequency").notNull().default("daily"), // "instant" (every crawl) | "daily" digest
    lastAlertedAt: ts("last_alerted_at").notNull().defaultNow(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("saved_searches_user_query").on(t.userId, t.query)],
);

/** Jobs a user said "not interested" to; filtered out of their feed. */
export const hiddenJobs = pgTable(
  "hidden_jobs",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.jobId] })],
);

/** Onboarding answers (roles, levels, remote, location, visa) used as the default feed filters. */
export const userPrefs = pgTable("user_prefs", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  prefs: jsonb("prefs").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});
