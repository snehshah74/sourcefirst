# SourceFirst

A job board that reads company career pages directly every 15 minutes, so you see a role minutes after it's posted and can be the 1st applicant, not the 500th.

[![ci](https://github.com/snehshah74/sourcefirst/actions/workflows/ci.yml/badge.svg)](https://github.com/snehshah74/sourcefirst/actions/workflows/ci.yml)
[![crawl](https://github.com/snehshah74/sourcefirst/actions/workflows/crawl.yml/badge.svg)](https://github.com/snehshah74/sourcefirst/actions/workflows/crawl.yml)
![next.js 16](https://img.shields.io/badge/next.js-16-111214)
![cost $0](https://img.shields.io/badge/hosting-%240-4d7c0f)
[![live](https://img.shields.io/badge/live-source--first.vercel.app-111214)](https://source-first.vercel.app)

## What is SourceFirst

SourceFirst watches the applicant tracking systems companies post to and lists every open role the moment it appears there. There is no reposting and no middleman: each job links to the company's own application page.

- **Straight from the source.** 559 company boards across 9 platforms: Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Rippling, Recruitee and Oracle Cloud. That's about 135,000 open roles.
- **Every 15 minutes.** A GitHub Actions crawler reads every board, adds new roles, and closes the ones that were taken down. Removed boards and dead postings never linger.
- **Made for applying.** Search, filters for visa sponsorship, level, years of experience and salary, a saved-jobs tracker, and a "Did you apply?" check instead of guessing for you.
- **Alerts that arrive first.** Save a search and get an email for each new match, or one daily digest. Alerts only go to confirmed addresses.
- **Free to run.** Vercel for the site, Supabase for Postgres, GitHub Actions for the crawler. Total hosting cost: $0.

## Quick start

```bash
git clone https://github.com/snehshah74/sourcefirst
cd sourcefirst
npm install
npm run dev
```

`npm run dev` starts the site at `http://localhost:3000` with an embedded Postgres in `./data/pg`, so there is nothing to configure. A full crawl of every board starts a few seconds after boot and repeats every 15 minutes while the server runs. Emails print to the server log until SMTP or Resend is set up.

Confirm the crawl finished. The dev server prints one line per run:

```
[pipeline] startup: ok=559 failed=0 new=13 closed=15 alerts=1 pruned=0 in 605.4s
```

`/status` shows the same thing per board.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Site plus local 15-minute crawler |
| `npm run ingest` | Run a crawl now |
| `npm test` | End-to-end pipeline tests against a throwaway database |
| `npm run lint` | ESLint |
| `npm run discover` | Find more company boards (see [Add companies](#add-companies)) |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |

## How it works

```
every 15 min ──► runPipeline()
                  ├─ crawl: each board → fetch (timeouts, retries) → enrich → upsert
                  │         → close roles that disappeared → drop boards that are gone
                  ├─ alerts: email each confirmed user the new matches for their saved searches
                  └─ prune: delete roles closed more than 14 days ago
```

- **Incremental, with an hourly full pass.** Most runs read only what changed; once an hour every board is read in full.
- **Nothing stale.** A role that returns 404 is closed on the spot, and a board that disappears three times in a row is disabled.
- **Empty-board guard.** A board that suddenly returns zero jobs isn't trusted until it happens three runs in a row.
- **One run at a time.** A run lock stops two schedulers from overlapping.
- **Enrichment.** Each role gets a category, level, minimum years, salary, remote flag and visa signal from its title and description.

## Deploy

[DEPLOY.md](DEPLOY.md) walks through it in about 30 minutes:

| Piece | Service | Notes |
|---|---|---|
| Website | Vercel Hobby | Use Supabase's **Transaction pooler** (port 6543) here |
| Crawler | GitHub Actions | Each run queues the next one 15 minutes after it started; free on a public repo |
| Database | Supabase Free | 500 MB; the crawler uses the **Session pooler** (port 5432) |
| Email | Gmail SMTP or Resend | Optional; without it emails go to the log |

Every push runs `.github/workflows/ci.yml`: lint, tests and a production build.

## Add companies

Coverage is freshness: more boards means more new roles an hour.

1. Add `Name|domain` lines to `scripts/candidates.txt`, or paste careers URLs from any of the 9 platforms into `scripts/boards.txt` (the only way to add Workday and Oracle boards).
2. Run `npm run discover`. Live boards are written to `src/lib/companies.discovered.json`.
3. The next crawl imports them. Their existing roles come in quietly, without triggering alerts.

A board that turns out to belong to the wrong company goes in `BLOCKLIST` in `src/lib/companies.ts`.

## Project layout

| Path | Contents |
|---|---|
| `src/lib/ats/` | One provider per platform |
| `src/lib/ingest.ts` | Crawl, upsert, close, run lock |
| `src/lib/enrich.ts` | Category, level, experience, salary, visa |
| `src/lib/alerts.ts`, `src/lib/email.ts` | Alert emails |
| `src/lib/auth.ts` | Accounts (Better Auth: email and password, optional Google) |
| `src/db/schema.ts`, `drizzle/` | Schema and migrations, applied automatically |
| `src/components/feed/` | The feed, cards, filters and job details |
| `.github/workflows/` | `crawl.yml` (the 15-minute crawler) and `ci.yml` |
