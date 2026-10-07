---
cursor:
  subagentId: "bc-ecf16999-a762-5e4d-83e3-ddf053109c87"
---

# Hosting Setup: Vercel + Supabase + AI Gateway

A step-by-step guide to putting LTS online so your phone and laptop use the same app and the same
data. Steps were checked against the Vercel and Supabase docs on 2026-10-07. Dashboards move
buttons around, so if a label differs, look for the nearest equivalent.

**What you end up with:** one production URL (e.g. `https://lts-yourname.vercel.app`), one Supabase
database behind it, and AI calls going through the Vercel AI Gateway with no model key stored in
production.

**When to do each part:**

| Part                             | Do it at                                          | Needed for                                  |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------- |
| A. GitHub + Vercel project       | Now (M0)                                          | Previews per PR; the skeleton deploys as-is |
| B. Supabase database + auth URLs | M1–M2                                             | Sign-in and data                            |
| C. Migrations                    | Each release with schema changes (first at M1/M2) | Tables in production                        |
| D. AI Gateway                    | M4                                                | AI interpretation                           |
| E. Phone + laptop check          | M2 onward, required at M5                         | Daily use                                   |

Prerequisite: the GitHub repository exists and `main` is pushed (see [git-setup.md](git-setup.md)).

## A. Create the Vercel project

1. Go to vercel.com and **sign up with GitHub** (the Hobby plan is free).
2. **Add New → Project** → import your `lts` repository. Vercel detects Next.js; keep the defaults
   (Vercel detects pnpm from `pnpm-lock.yaml` and runs `pnpm build`).
3. Click **Deploy**. The M0 placeholder page should load at the URL Vercel shows. That URL is your
   **production URL**; write it down.
4. Check the function region: **Project → Settings → Functions → Function Regions**. New projects
   default to **`iad1` (Washington, D.C., USA)**. Hobby projects run functions in a single region.
   Keep `iad1` unless you have a reason to move it. If you do move it, note the new region, because
   Part B must match it.

From now on, every push to `main` deploys to production, and every PR gets a preview URL.

## B. Create the Supabase database

### Option 1 (recommended): through the Vercel Marketplace

This links billing and **syncs the environment variables into Vercel automatically**.

1. In your Vercel project, open the **Storage** tab → **Create Database** → choose **Supabase**.
   (Alternatively, run `vc i supabase` in the repo folder with the Vercel CLI.)
2. Name it `lts`. Pick the region **closest to your function region**: for `iad1`, choose
   **East US (North Virginia), `us-east-1`**. A far-away database adds latency to every request.
3. Choose the **Free** plan.
4. When asked which environments to connect, select **Production** and **Development**. Leave
   **Preview** unconnected for now (see "Preview deployments" below).
5. After creation, Vercel adds these variables to the project (Settings → Environment Variables):
   `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`, `POSTGRES_USER`,
   `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. LTS uses `POSTGRES_URL` (runtime, pooled),
   `POSTGRES_URL_NON_POOLING` (migrations), `NEXT_PUBLIC_SUPABASE_URL`, and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **Never** copy `SUPABASE_SECRET_KEY` into client code.
6. Open Supabase Studio from the Vercel Storage page whenever you want to look at the data.

Marketplace notes: projects created this way can only be created from the Vercel dashboard, and
invoices are handled in Vercel. The integration is documented by Supabase as Public Alpha; if it
misbehaves, use Option 2.

### Option 2: directly at supabase.com

1. supabase.com → **New project** → name `lts`, generate and **save the database password**, region
   **East US (North Virginia)** (or whatever matches your Vercel function region), Free plan.
2. Open the project → **Connect** (top of the page) and copy:
   - **Transaction pooler** string (port `6543`) → `POSTGRES_URL`
   - **Direct connection** string (port `5432`, host `db.<ref>.supabase.co`) →
     `POSTGRES_URL_NON_POOLING`. On the Free plan this host is IPv6-only. If your network can't
     reach it, use the **Session pooler** string (pooler host, port `5432`) instead.
   - Replace `[YOUR-PASSWORD]` and percent-encode special characters (`&`, `#`, `?`, space).
3. From **Project Settings → API Keys**, copy the project URL → `NEXT_PUBLIC_SUPABASE_URL` and the
   **publishable** key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. In Vercel → **Settings → Environment Variables**, add those four for **Production** (and
   Development if you'll use `vercel env pull`).

### Configure sign-in redirects (both options)

Supabase → **Authentication → URL Configuration**:

- **Site URL:** your production URL, e.g. `https://lts-yourname.vercel.app` (it defaults to
  `http://localhost:3000`, which breaks magic links).
- **Redirect URLs:** add `http://localhost:4317/**`. If you later connect previews, also add
  `https://*-<your-vercel-team-slug>.vercel.app/**`.

In Vercel, add `NEXT_PUBLIC_SITE_URL` = your production URL (Production environment).

### How the app connects (for M1 code)

Serverless functions should use the **transaction pooler** (`POSTGRES_URL`) with prepared statements
off and a pool of one connection per function instance:

```ts
postgres(process.env.POSTGRES_URL!, { max: 1, prepare: false, ssl: "require" });
```

Migrations and `pg_dump` use the non-pooled URL.

### Preview deployments

If Preview were connected to the same database, any unmerged PR could read and write your real data.
For v1, either leave previews without a database (pages that need data will show their error
state), or create a second free Supabase project, `lts-preview`, connect it only to Preview, and run
migrations against it too.

## C. Run migrations against production

`pnpm db:generate` / `pnpm db:migrate` arrive in M1. To apply them to the hosted database:

```bash
npm i -g vercel            # or prefix commands with: pnpm dlx vercel
vercel login
vercel link                # pick the lts project
vercel env pull .env.production.local --environment=production
pnpm dlx dotenv-cli -e .env.production.local -- pnpm db:migrate
rm .env.production.local   # don't leave production secrets lying around (it is git-ignored anyway)
```

If the migration can't connect (timeouts or `ENETUNREACH`), your network is IPv4-only and the
non-pooled URL is the IPv6 direct host. Re-run with the **Session pooler** string from Supabase →
Connect as `POSTGRES_URL_NON_POOLING`.

Order for a release with schema changes: migrate first, then merge or promote the code that needs it
(the playbook's "Release and deployment verification").

## D. Enable the AI Gateway (M4)

1. Vercel dashboard → **AI Gateway**. To use the free AI Gateway credits, Vercel requires a valid
   payment method on your team. Add one, then set a **budget** so a bug can't run up a bill.
2. **Local development:** AI Gateway → **API Keys** → **Create key**. Copy it immediately (it can't
   be shown again) into `.env.local`:

   ```bash
   LTS_AI_PROVIDER=gateway
   LTS_AI_MODEL=<creator/model from the AI Gateway model list>
   AI_GATEWAY_API_KEY=<your key>
   ```

   API keys are tied to the person who created them and don't expire unless revoked.
   (Alternative: `vercel env pull` also provides an OIDC token locally, but it expires after 12
   hours, so you'd have to re-pull it.)

3. **On Vercel:** add **no** API key. Deployments get an OIDC token (`VERCEL_OIDC_TOKEN`)
   automatically, and the AI SDK uses it when `AI_GATEWAY_API_KEY` is not set. Add these variables
   for Production:
   - `LTS_AI_PROVIDER=gateway`
   - `LTS_AI_MODEL=<same model id>`
   - `LTS_AI_TRACE_MODE=metadata` (no raw prompt/output text stored in production)
   - `LTS_AI_TRACE_RETENTION_DAYS=7`
4. Redeploy (Deployments → ⋯ → Redeploy) so the new variables apply. After a capture, check
   **AI Gateway → Logs**: the request should show model, tokens, cost, and status (logs can take up
   to about 90 seconds to appear).
5. Review the AI Gateway's own logging/retention settings in the dashboard. LTS's trace-retention
   rule covers LTS's database, not Vercel's logs.

## E. Use it on phone and laptop

1. On both devices, open the **same production URL**. Don't use preview URLs for real life data.
2. Sign in with the **same email** on both. Open the magic link **on the device you're signing in
   on**, because the link signs in the browser that opens it.
3. On the phone: browser menu → **Add to Home Screen** for one-tap access.
4. Sync check: create a task on the laptop, then refresh Today on the phone. It should appear.
   LTS keeps no data in the browser (only the sign-in cookie); both devices read the same Supabase
   database, so there is nothing to sync manually.
5. After each deploy: `/api/health` shows the new version and `db: ok` (from M2).

## Costs and limits to know

- Vercel Hobby, Supabase Free, and the AI Gateway free credits cover a single-user v1. Check each
  service's current limits before relying on them.
- Supabase free-plan projects can be paused after a period of inactivity; check the current
  free-plan rules and restore the project from the dashboard if that happens.
- Set an AI Gateway budget (step D1) before turning AI on in production.

## Local development (unchanged)

Day-to-day work runs against the **local** Supabase stack (`supabase start`, Docker) with the
`.env.example` values in `.env.local`. Your real data never touches your laptop's dev database.

## M2 deploy check

Do this once when M2 is merged (Vercel deploys `main` to production on its own). Below,
`<prod>` means your production URL exactly as Vercel shows it, e.g. `https://lts-yourname.vercel.app`,
with no trailing slash.

**1. Auth redirect URLs** (Supabase → Authentication → URL Configuration)

- [ ] **Site URL** = `<prod>`
- [ ] **Redirect URLs** include both `<prod>/**` and `http://localhost:4317/**`
- [ ] Keep the default Magic Link email template. Only if links opened from your phone's mail app
      keep showing "That link didn't work": in Authentication → Emails → Magic Link, change the
      link to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`. Links made that way work
      in any browser.

**2. Environment variables on Vercel Production** (Project → Settings → Environment Variables,
Production)

- [ ] `POSTGRES_URL`: synced by the Supabase integration
- [ ] `POSTGRES_URL_NON_POOLING`: synced by the integration (only migrations use it)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`: synced by the integration
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: synced by the integration. If only
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` is there, that works too.
- [ ] `NEXT_PUBLIC_SITE_URL` = `<prod>`: add this one yourself
- [ ] None of the variables above are set for **Preview**. There is no `AI_GATEWAY_API_KEY`
      anywhere on Vercel. The `LTS_AI_*` variables aren't needed until M4.
- [ ] If you added or changed any of these after the last production deploy, go to Deployments,
      open the latest Production deploy, choose ⋯ → **Redeploy**. `NEXT_PUBLIC_*` values are
      fixed when the app is built.

**3. Run the production migrations** (from the repo on your laptop)

M2 adds no new migrations. This step applies M1's `0000_init` if production doesn't have it yet;
otherwise it does nothing. Running it again is safe.

```bash
git switch main && git pull
pnpm install --frozen-lockfile
pnpm dlx vercel link                    # once; pick the lts project
pnpm dlx vercel env pull .env.production.local --environment=production
pnpm dlx dotenv-cli -e .env.production.local -- pnpm db:migrate
```

- [ ] The output starts with `Database: <something>.supabase.com:5432/postgres` (or
      `db.<ref>.supabase.co`), **not** `127.0.0.1` or `localhost`, and ends with
      `migrations applied successfully!` (or `nothing to migrate`).
- [ ] Delete `.env.production.local` (`rm .env.production.local`; on Windows,
      `del .env.production.local`).
- If it times out or prints `ENETUNREACH`, follow Part C above (Session pooler string).
- Never run `pnpm db:seed` against production. It refuses non-local databases anyway.

**4. Check sign-in and Today on the laptop**

- [ ] `<prod>/api/health` returns
      `{"status":"ok","version":"0.2.0","commit":"<first 7 characters of the deployed commit>","db":"ok"}`.
      If you see `"db":"error"` (HTTP 503), recheck `POSTGRES_URL` and step 3.
- [ ] In a private window, `<prod>/today` redirects to `/sign-in?next=%2Ftoday`.
- [ ] On `<prod>`, enter your email and press **Send link**. You see "Check your email". Open the
      email **on the laptop** and click the link in the same browser. You land on `/today`, which
      shows today's date and "Times shown in America/Chicago" (or your own timezone).
- [ ] Today shows "Nothing planned yet." That is expected: production has no seed data, and
      capture arrives in M3.
- [ ] Supabase → Table Editor → `profiles` has one row with your timezone.

**5. Check sign-in and Today on the phone**

- [ ] Open the same `<prod>` URL in Safari or Chrome (not a preview URL). Ask for the link **from
      the browser your mail app opens links in**. Sign-in links only work in the browser that
      requested them, unless you changed the template in step 1.
- [ ] Open the email on the phone and tap the link. You land on Today with the same date and
      timezone as on the laptop, and Supabase still shows one `profiles` row (same account, same
      data).
- [ ] Optional: browser menu → **Add to Home Screen**.
- If you see "Too many links were requested", Supabase's built-in email sender allows only a few
  emails per hour. Wait, then try again.
- Optional, once both devices are signed in: Supabase → Authentication → Sign In / Providers →
  turn off **Allow new users to sign up**, so nobody else can create an account.
