# Jobly

A job application tracker with one-click capture from job postings —
including LinkedIn — accounts, and a Postgres database via Supabase, ready
to deploy on Vercel.

## Why not just fetch the URL automatically?

Most job boards embed structured data (`JobPosting` JSON-LD) that a server
can fetch and parse directly — Jobly does this via the paste-to-parse flow.
LinkedIn doesn't: job pages sit behind a soft login wall, so a server-side
fetch gets redirected instead of the real page. Jobly works around this with
a small browser extension that reads the page from inside your own logged-in
tab (the same way you'd read it with your eyes) and sends the extracted
fields to your Jobly instance with one click.

## What's here

- `app/`, `lib/` — the Next.js app: sign-in/sign-up, a dashboard to
  browse/filter/edit your applications, plus the API it talks to.
- `extension/` — an unpacked Chrome extension (Manifest V3) that captures the
  job on whatever page you're viewing and saves it to your account.
- `supabase/schema.sql` — the database schema (tables, indexes, Row Level
  Security policies) to run once in your Supabase project.
- Storage is Postgres via [Supabase](https://supabase.com), which also
  provides the login system (email + password). Each user only ever sees
  their own applications — enforced at the database level with Row Level
  Security, not just in application code.

## Setting up Supabase (one-time)

1. Create a free project at [supabase.com](https://supabase.com/dashboard).
2. In the SQL Editor (left sidebar), paste the contents of
   `supabase/schema.sql` and run it. This creates the `jobs` and
   `api_tokens` tables with Row Level Security enabled.
3. Go to **Project Settings → API** and copy three values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key (click reveal) → `SUPABASE_SERVICE_ROLE_KEY` — keep
     this one secret, it's server-only and bypasses Row Level Security.
4. (Optional, recommended for quick local testing) Under **Authentication →
   Sign In / Providers → Email**, turn off "Confirm email" so new accounts
   don't need to click an email link before they can sign in. Turn it back
   on before sharing this with anyone else.

## Running it locally

```bash
npm install
cp .env.example .env.local   # paste in the three Supabase values above
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up for an account,
and you're in. Use "+ Add application" to add jobs manually, or paste a job
description for Jobly to auto-fill fields from.

## Setting up the extension

1. Go to `chrome://extensions`, enable **Developer mode**, click **Load
   unpacked**, and select the `extension/` folder.
2. Sign in to your Jobly dashboard, open **Settings** (top of the dashboard),
   and copy your personal API token.
3. Click the Jobly icon in your toolbar → **Options**. Set:
   - **Jobly URL** — `http://localhost:3000` for local use, or your deployed
     URL.
   - **Personal API token** — the value from step 2.
4. Click **Test connection** to confirm it can reach your Jobly instance and
   that the token is valid.

Each person's token is private to their account — the extension identifies
who a captured job belongs to by which token it sends, so there's no login
UI needed inside the extension itself. If you ever suspect your token
leaked, rotate it from the Settings page; the old one stops working
immediately.

### Using it

Open a job posting (LinkedIn, Greenhouse, Lever, Workday, or most other
boards), click the Jobly icon, review the auto-filled title/company/location,
adjust status/date if needed, and click **Save to Jobly**. There's also an
optional **Job link** field in the popup — it's pre-filled with the current
tab's URL, but if you'd rather file the job under a different link (say, the
company's own careers page instead of a job board's), just type over it
before saving; leave it blank and Jobly uses the tab's URL. Saving the same
URL again updates the existing entry instead of creating a duplicate.

If a site's layout changes and the extension can't find the fields, you can
always fall back to the dashboard's "Paste job text" flow: copy the visible
job description and Jobly will do its best to extract the fields from the
text. LinkedIn's extractor in particular is built to be resilient to this —
see the comments in `extension/content.js` for how.

## Deploying to Vercel

1. Push this repo to GitHub, then [import it into
   Vercel](https://vercel.com/new).
2. In the project's **Settings → Environment Variables**, add the same three
   variables from `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Deploy. No persistent filesystem or separate database host needed —
   Supabase's Postgres is already reachable over the network from Vercel's
   serverless functions.
4. In Supabase, under **Authentication → URL Configuration**, add your
   Vercel deployment's URL as a **Redirect URL** (and as the **Site URL**)
   so auth emails link back to the right place.
5. Update the extension's Options page with the deployed URL (your token
   stays the same).

## API

All routes except `/api/capture`, `/api/health`, and `/api/parse` require a
signed-in session (cookie-based) and only ever return/modify the signed-in
user's own rows.

- `GET /api/jobs?status=&q=` — list applications
- `POST /api/jobs` — create one manually `{ company, title, url, ... }`
- `PATCH /api/jobs/:id` / `DELETE /api/jobs/:id`
- `POST /api/capture` — used by the extension, requires
  `Authorization: Bearer <personal token>`; dedupes on `url` per user
- `POST /api/parse` — best-effort field extraction from pasted `text` and/or
  `html`, used by the dashboard's paste flow
- `GET /api/tokens` / `POST /api/tokens` — fetch or rotate your personal
  token (used by the Settings page)
- `GET /api/health` — reachability check, optionally validates a bearer
  token; used by the extension's "Test connection" button
