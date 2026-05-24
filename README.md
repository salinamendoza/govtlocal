# Emergency Resource Directory

A small, fast, **offline-first** web app for posting and finding emergency resources during a crisis — shelters, food sites, medical stations, donation drop-offs, volunteer needs. Built so it keeps working when wifi is overloaded or out entirely.

Once a phone has loaded the app a single time, every subsequent visit reads from local storage and renders in under half a second. Submissions made offline queue locally and send themselves when connectivity returns. There is no login for residents. Admin moderation is a single password.

This is a template — clone it, run it for whatever event you need.

## Stack

- **SvelteKit** (Svelte 5 runes) + **TypeScript**
- **Tailwind CSS v4**
- **Cloudflare Pages** for hosting
- **Cloudflare D1** as source of truth
- **Cloudflare KV** for ephemeral rate-limit counters
- **Cloudflare Turnstile** for bot defense on public submissions
- **Service Worker + IndexedDB** for the offline mirror and submission outbox

No login, no analytics, no third-party CDNs, no PII stored.

## What's deployed

Three public surfaces and one admin surface:

- `/help` — search and filter approved resources by category
- `/donate` — same, for donation opportunities
- `/report` — anonymous resident reports (works offline, queued in IndexedDB)
- `/admin` — moderation queue, EOC updates, hazard zones, reports inbox (password-protected)

## Deploy from scratch

You need: a Cloudflare account, a GitHub repo, and the `wrangler` CLI.

### 1. Create the D1 database

```bash
npx wrangler d1 create emergency-resources
```

Copy the returned `database_id` into `wrangler.toml`, replacing `REPLACE_AFTER_WRANGLER_D1_CREATE`.

### 2. Create the KV namespace

```bash
npx wrangler kv namespace create RATELIMIT
```

Copy the returned `id` into `wrangler.toml`, replacing `REPLACE_AFTER_WRANGLER_KV_CREATE`.

### 3. Run migrations

```bash
npx wrangler d1 execute emergency-resources --file=migrations/0001_init.sql --remote
npx wrangler d1 execute emergency-resources --file=migrations/0002_offline.sql --remote
npx wrangler d1 execute emergency-resources --file=migrations/0003_drop_ip.sql --remote
```

(Optional) Seed with one pre-approved entry so `/help` isn't empty on first load:

```bash
npx wrangler d1 execute emergency-resources --file=scripts/seed.sql --remote
```

Edit `scripts/seed.sql` first if you want to start with your own real entries.

### 4. Connect the repo to Pages

Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.

- Build command: `npm run build`
- Build output directory: `.svelte-kit/cloudflare`
- Framework preset: SvelteKit (or "None")

### 5. Bind D1 and KV to the Pages project

Dashboard → your Pages project → Settings → Functions → Bindings:

- Add **D1 database binding**: variable name `DB`, database `emergency-resources`
- Add **KV namespace binding**: variable name `RATELIMIT`, namespace whichever you created

### 6. Set environment variables

Dashboard → Settings → Environment variables → Production (and Preview):

| Name | Type | What |
|---|---|---|
| `ADMIN_SECRET` | Secret | Your admin password. `openssl rand -base64 32` |
| `IP_HASH_PEPPER` | Secret | Pepper for hashing client IPs into rate-limit keys. `openssl rand -hex 32` |
| `TURNSTILE_SECRET_KEY` | Secret | Server-side Turnstile secret (see step 7) |
| `PUBLIC_TURNSTILE_SITE_KEY` | Plaintext | Public Turnstile site key (embedded in client bundle) |

### 7. Set up Turnstile

Dashboard → Turnstile → Add site. Use the **Managed** widget. Copy the site key and secret into the env vars above. Redeploy.

(Without Turnstile configured the app still works — Turnstile verification silently skips. But you'll want it on for any public link.)

### 8. Add Cloudflare dashboard rules (no code)

These are critical when the link is shared publicly:

- **Security → Bots → Bot Fight Mode**: ON
- **Security → WAF → Managed Rules**: enable the Cloudflare Managed Ruleset
- **Security → WAF → Rate Limiting Rules**:
  - `POST /submit/*` → 10 requests / 60 seconds per IP → block 10 min
  - `POST /api/reports` → 60 requests / 60 seconds per IP → block 5 min

### 9. First admin sign-in

Visit `/admin/login` and use your `ADMIN_SECRET`. Cookie is HttpOnly, Secure, SameSite=Strict, expires in 12 hours.

## Local development

This repo is designed to be developed in the browser via Claude Code on the web — no local setup needed. If you want to run locally anyway:

```bash
npm install
npm run dev
```

D1 and KV won't be bound locally without additional wrangler setup; reads will throw 500s until you set up local bindings or use `wrangler pages dev`.

## Day-to-day operations

- **Approve submissions**: `/admin` → click Approve. Approvals bump the snapshot version, so every connected client picks them up on their next 60s poll.
- **Post an update**: `/admin/updates` → Critical/Urgent updates surface as a banner above the resource list on every device.
- **Add a hazard zone**: `/admin/hazards` → paste GeoJSON (use [geojson.io](https://geojson.io) to draw and copy).
- **Triage reports**: `/admin/reports` → status defaults to `new`; mark `triaged`/`resolved`/`dismissed` as you process them.

## Architecture notes

- **Source of truth is D1.** The server is canonical.
- **Every client carries a full mirror** in IndexedDB. First paint after first visit hits zero network.
- **A single `/api/snapshot` endpoint** returns the version-stamped bundle of all approved entries + active hazards + recent updates. Clients send `If-None-Match` and get `304` when nothing changed.
- **Resident reports go to an outbox** in IndexedDB and POST in batches with idempotent client UUIDs.
- **The service worker** precaches the build, network-firsts the snapshot with cache fallback, and runs Background Sync on supported browsers.
- **No IPs persist anywhere.** Per-IP rate limit uses HMAC(ip, pepper) as a KV key with a TTL.

## Out of scope for v1

Deliberate omissions, listed so future-you knows they were skipped, not forgotten:

- Map view / GeoJSON rendering on the client (hazards stored, not yet drawn)
- Multi-language UI (Spanish is the obvious next add)
- Saved searches / email alerts
- Submitter accounts
- Analytics
- CSV export for partner orgs
- Auto-archive / scheduled cleanup (Pages has no cron; would migrate to Workers for this)
- Switch from `ADMIN_SECRET` to Cloudflare Access (single-line swap in `hooks.server.ts` when admin team grows past one person)
