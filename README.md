# SourceFirst

A job board that reads company job boards on 9 applicant tracking systems (Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Rippling, Recruitee, Oracle Cloud) directly every 15 minutes, so jobs show up here before they reach LinkedIn or Indeed. Users can create accounts, save jobs, track applications, and get email alerts for saved searches.

## Run it locally (no setup needed)
```bash
npm install
npm run dev          # http://localhost:3000
```
That's all. Locally the app uses an **embedded Postgres** (PGlite, stored in `./data/pg`) and a **built-in scheduler**. The first crawl starts a few seconds after boot, then repeats every 15 minutes while the server runs. Emails (alerts, password resets) print to the server log until `RESEND_API_KEY` is set.

```bash
npm run ingest       # trigger a crawl now (asks the running app to do it)
npm test             # end-to-end pipeline tests against a throwaway database
npm run discover     # find more company boards (see below)
```

Pages: `/` feed · `/sign-up` · `/sign-in` · `/account` (tracker summary, saved searches and alerts) · `/status` (pipeline health) · `/jobs/<slug>` (SEO pages).

## The pipeline
```
scheduler (every 15 min) ──► /api/cron/ingest ──► runPipeline()
                                                   ├─ runIngest(): for each enabled company board
                                                   │    fetch (timeout + 3 retries) → enrich → upsert
                                                   │    → close vanished jobs (with an empty-board guard)
                                                   └─ sendAlerts(): email each user the jobs that are
                                                        new since their last alert, per saved search
```
- **Run lock:** a crawl that starts while another is running is skipped, so two schedulers can't overlap.
- **Board health:** each board's failure count and last error are stored and shown on `/status`.
- **Empty-board guard:** a board that suddenly returns 0 jobs only gets its jobs closed after 3 empty crawls in a row.
- **"New" means newly discovered:** on a company's first crawl, its backlog is imported without alerting anyone.

| Piece | File |
|---|---|
| Company list (board tokens) | `src/lib/companies.ts` |
| ATS fetchers with retries | `src/lib/ats/index.ts` |
| Enrichment (visa, US, experience, role, level) | `src/lib/enrich.ts` |
| Crawl, upsert, close, lock | `src/lib/ingest.ts` |
| Email alerts (instant or daily digest) | `src/lib/alerts.ts`, `src/lib/email.ts` (Gmail SMTP, Resend, or log) |
| Schedulers | `.github/workflows/crawl.yml` (production, free), `src/instrumentation.ts` (local/servers), `vercel.json` (daily backup) |
| DB schema and migrations | `src/db/schema.ts`, `drizzle/` (applied automatically on boot) |
| Auth (Better Auth: email/password, optional Google) | `src/lib/auth.ts`, `src/app/api/auth/[...all]` |
| User APIs | `src/app/api/me/saved`, `src/app/api/me/searches` |

## Deploy for free
Step-by-step guide: **[DEPLOY.md](DEPLOY.md)**. It uses Vercel Hobby for the site, GitHub Actions for the 15-minute crawler, Supabase for Postgres, Gmail SMTP for email and Healthchecks.io for monitoring. Total cost: $0.

## Changing the schema
Edit `src/db/schema.ts`, run `npm run db:generate`, and commit the new file in `drizzle/`.

## Adding companies (coverage = freshness)
How fresh the feed feels depends on how many companies you crawl: 271 boards produce roughly 15–25 new jobs an hour.
1. Add `Name|domain` lines to `scripts/candidates.txt`.
2. Run `npm run discover`. It tries each name on Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Rippling and Recruitee, and checks every careers URL in `scripts/boards.txt` (the only way to add Workday and Oracle boards, whose ids can't be guessed). Live boards go to `src/lib/companies.discovered.json`.
3. Restart the app. The next crawl imports the new boards; their existing jobs come in without triggering alerts.

If a discovered board turns out to belong to a different company, add it to `BLOCKLIST` in `src/lib/companies.ts`.

## Next steps
- **Coverage:** keep growing `candidates.txt` and `scripts/boards.txt` (paste any careers URL from the 9 supported platforms).
- **AI enrichment:** send only `visa = 'Maybe'` jobs to an LLM.
- **Email verification** before sending alerts (needs Resend configured).
