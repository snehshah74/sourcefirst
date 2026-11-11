# Deploy SourceFirst for $0

Everything below uses free plans. Total time: about 30 minutes. You need five free accounts: **GitHub, Supabase, Vercel, a Gmail address for sending, and Healthchecks.io** (optional).

```
GitHub Actions (every 15 min) ──crawl──► Supabase Postgres ◄──read── Vercel (the website)
          │                                                              ▲
          └──── alert emails via Gmail SMTP                     users ───┘
Healthchecks.io emails you if the crawler stops.
```

| Piece | Free service | Limit to know about |
|---|---|---|
| Website, API, sign-in | Vercel Hobby | Non-commercial use only. Scheduled jobs at most once a day (only a daily backup crawl runs there). |
| 15-minute crawler | GitHub Actions | Unlimited on a **public** repo. Private repo: ~2,000 min/month, so crawl every 30 min instead (see step 3). |
| Database | Supabase Free | 500 MB. Closed jobs are deleted after 14 days, which keeps you far below it (~40 MB per 30k jobs). Pauses after 7 idle days; the crawler prevents that. |
| Email | Gmail SMTP | ~500 emails/day. Alerts default to a daily digest so this goes a long way. |
| Monitoring | Healthchecks.io | 20 checks free. |

---

## 1. Put the code on GitHub
1. Create a new repository on GitHub. **Public** is recommended so the 15-minute crawler is free with no minute limit; your secrets stay private either way.
2. From the `sourcefirst` folder, run:
   ```bash
   git add -A && git commit -m "SourceFirst"
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

## 2. Create the database (Supabase)
1. Go to supabase.com → **New project**. Pick a region close to you and save the database password.
2. Open **Connect** (top bar) → **Session pooler**. Copy the URI. It looks like
   `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`.
   - Use the **Session pooler**, not "Direct connection". Vercel and GitHub Actions need IPv4, and the session pooler provides it.
3. That's all. Tables are created automatically on first run.

## 3. Turn on the crawler (GitHub Actions)
1. In your repo: **Settings → Secrets and variables → Actions → New repository secret**. Add:
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Supabase session pooler URI |
   | `SITE_URL` | `https://<your-app>.vercel.app` (fill in after step 4; links in emails use it) |
   | `SMTP_USER` | the Gmail address that sends alerts (step 5) |
   | `SMTP_PASS` | its 16-character App Password (step 5) |
   | `HEALTHCHECK_URL` | optional, from step 6 |
2. Go to **Actions → crawl → Run workflow** to start the first crawl now. It takes 1–2 minutes and fills the database.
3. After that it runs every 15 minutes by itself.
   - **Private repo?** Edit `.github/workflows/crawl.yml` and change the cron to `"*/30 * * * *"` to stay within the free minutes.
   - GitHub pauses schedules in public repos after 60 days with no commits. Pushing any commit re-enables them.

## 4. Deploy the website (Vercel)
1. vercel.com → **Add New → Project** → import your GitHub repo. Framework: Next.js (detected automatically).
2. Before clicking Deploy, add **Environment Variables**:
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | same Supabase URI |
   | `BETTER_AUTH_SECRET` | run `openssl rand -base64 32` and paste the output |
   | `BETTER_AUTH_URL` | `https://<your-app>.vercel.app` |
   | `SITE_URL` | `https://<your-app>.vercel.app` |
   | `CRON_SECRET` | run `openssl rand -hex 24` (protects the daily backup crawl) |
   | `SMTP_USER`, `SMTP_PASS` | same as GitHub (password-reset emails come from the website) |
3. Deploy. If your URL differs from what you guessed, update `BETTER_AUTH_URL` and `SITE_URL` (in Vercel and GitHub), then redeploy.

## 5. Email (Gmail, free)
1. Use a Gmail account (a new one just for the app is a good idea).
2. Turn on **2-Step Verification**: myaccount.google.com → Security.
3. Create an **App Password**: myaccount.google.com/apppasswords → name it "SourceFirst" and copy the 16 characters.
4. Use the address as `SMTP_USER` and the app password as `SMTP_PASS`.
   - Later, with your own domain, you can switch to Resend: set `RESEND_API_KEY` and `EMAIL_FROM` instead.

## 6. Monitoring (optional, Healthchecks.io)
1. healthchecks.io → **Add Check** → period **15 minutes**, grace **30 minutes**.
2. Copy its ping URL into the `HEALTHCHECK_URL` GitHub secret.
3. If crawls stop, or most boards fail, you get an email. The site's own `/status` page shows recent runs and failing boards.

## 7. Optional: Google sign-in
Google Cloud Console → APIs & Services → Credentials → **OAuth client ID** (Web).
- Authorized redirect URI: `https://<your-app>.vercel.app/api/auth/callback/google`
- Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to Vercel and redeploy. The "Continue with Google" button appears automatically.

---

## Checking it works
- `https://<your-app>.vercel.app/status` shows "Healthy" and a run within the last 15 minutes.
- Sign up, create an alert, and wait for the next crawl. Instant alerts arrive within ~15 minutes; daily digests once a day.
- GitHub → Actions shows a green `crawl` run every ~15 minutes.

## Growing coverage
Add companies to `scripts/candidates.txt`, run `npm run discover` locally, commit the updated `src/lib/companies.discovered.json`, and push. The next crawl picks them up.
