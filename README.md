# Jobly

A job application tracker with one-click capture from job postings —
including LinkedIn — accounts, and a Postgres database via Supabase, ready
to deploy on Vercel.

## What it does

- **Tracks applications** — company, title, job link, location, salary,
  applied date, status, and notes, in a filterable/searchable dashboard.
- **Status pipeline** — Saved → Applied → Interviewing → Offer / Rejected /
  Withdrawn, changeable inline from the dashboard table.
- **One-click capture from the browser** — the Chrome extension reads the
  job posting on whatever page you're viewing (LinkedIn included) and
  pre-fills a title/company/location for you to review and save.
- **Shows up on the dashboard immediately** — a job saved by the extension
  appears on an already-open dashboard tab right away, live, with no
  manual refresh needed (via a realtime subscription; falls back to
  re-checking whenever the tab regains focus, in case that connection
  ever drops).
- **Paste-to-parse fallback** — for any site the extension can't read,
  paste the job text into the dashboard and Jobly extracts what it can.
- **Accounts** — email/password sign-up and sign-in via Supabase Auth.
  Every application is private to the account that created it, enforced by
  Postgres Row Level Security (not just app-level checks).
- **Sign in from the extension itself** — the extension links to your
  account by signing in with your email and password, the same as the
  dashboard. No token to copy. (A personal API token is still available on
  the Settings page as an advanced option for scripting against the API
  directly.)
- **Deployed on Vercel** — serverless-friendly since storage is Supabase's
  hosted Postgres rather than a local file.

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

If your project already existed before this feature was added and the
dashboard isn't updating live, re-run `supabase/schema.sql` in the SQL
Editor — it's safe to re-run, and the bottom of the `jobs` section adds the
table to Supabase's realtime publication (this is what the dashboard
subscribes to for live updates).

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
2. Click the Jobly icon in your toolbar → **Options**. Enter the same
   email and password you use on the dashboard, and click **Sign in**.
   That's it — no URL to set, no token to find or paste. The extension
   already points at the deployed Jobly app.
3. Click **Test connection** (under **Advanced: Jobly URL**) any time to
   confirm the extension can reach Jobly and that your session is valid.

The extension ships with the deployed URL baked in as its default, so
there's nothing to configure out of the box. If you're running Jobly
locally instead (`npm run dev`) or on a different deployment, open
**Advanced: Jobly URL** in Options, enter that URL, and click **Save
URL** — leave it blank to fall back to the default again.

The extension keeps you signed in the way any app does: it holds a session
that refreshes itself automatically in the background, so you won't need to
re-enter your password often. If you ever want to disconnect the extension
from your account, open Options and click **Sign out** — this only affects
this browser, your dashboard session elsewhere is untouched.

Since jobs saved by the extension are tied to whoever is signed in, if you
use Jobly on a shared or borrowed computer, sign out of the extension
afterward the same way you'd sign out of any account.

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
5. If you deploy your own fork to a different URL than
   `https://jobly-puce.vercel.app`, update `DEFAULT_API_URL` in
   `extension/config.js` before loading the extension, so it points at
   your deployment out of the box. (Or leave it as-is and set your URL
   once under Options → **Advanced: Jobly URL**.)

## Troubleshooting

**"Internal Server Error" right after deploying, with a runtime log saying
`Your project's URL and Key are required to create a Supabase client!`** —
the three Supabase env vars aren't actually reaching the running app. Almost
always one of:

- The variables were saved in Vercel *after* the current deployment was
  built. Saving an env var doesn't retroactively apply to a deployment
  that's already running — go to **Deployments → (latest) → ⋯ →
  Redeploy**.
- The **Production** checkbox wasn't ticked for one of the variables when
  it was added (they can be scoped per environment).
- A stray character snuck into the value — e.g. pasting a value that still
  has surrounding quotes (`"eyJ..."`) copied from a `.env` file. Vercel's
  value field should hold just the raw key, no quotes around it.
- A typo in the variable name — it must match exactly:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`.

To see the real error for anything else that comes up: Vercel project →
**Deployments** → click the deployment → **Runtime Logs**, then reproduce
the failing request.

## API

All routes except `/api/auth/*`, `/api/capture`, `/api/health`, and
`/api/parse` require a signed-in session (cookie-based) and only ever
return/modify the signed-in user's own rows.

- `GET /api/jobs?status=&q=` — list applications
- `POST /api/jobs` — create one manually `{ company, title, url, ... }`
- `PATCH /api/jobs/:id` / `DELETE /api/jobs/:id`
- `POST /api/capture` — used by the extension, requires
  `Authorization: Bearer <token>`; dedupes on `url` per user. The bearer
  token can be either a Supabase session access token (from
  `/api/auth/signin`, what the extension uses) or a personal API token
  (the advanced/scripting option) — both are checked.
- `POST /api/parse` — best-effort field extraction from pasted `text` and/or
  `html`, used by the dashboard's paste flow
- `GET /api/tokens` / `POST /api/tokens` — fetch or rotate your personal
  token (used by the Settings page's advanced section)
- `GET /api/health` — reachability check, optionally validates a bearer
  token (session or personal token); used by the extension's "Test
  connection" button
- `POST /api/auth/signin` — used by the extension's sign-in form; takes
  `{ email, password }`, returns a Supabase session
  (`accessToken`/`refreshToken`/`expiresAt`). This exists so the extension
  can sign in directly without embedding the Supabase SDK — it only needs
  to know your Jobly URL, same as everything else it talks to.
- `POST /api/auth/refresh` — takes `{ refreshToken }`, returns a refreshed
  session; the extension calls this automatically shortly before its
  current access token expires (about once an hour), so you stay signed in
  without re-entering your password.
