# Khidmati DZ — Services à domicile en Algérie

> « Le bon professionnel, au bon moment. » — « الحرفي المناسب، في الوقت المناسب. »

A full-stack marketplace connecting clients in Algeria with **verified** home-service technicians: discovery, quote requests, quotes, bookings, cash payment records, chat, reviews, disputes, support and administration. French (default) and Arabic (RTL).

**Production URL:** not deployed yet. It needs a managed PostgreSQL database and a deploy from an account with Vercel write access; see [Deployment](#7-deployment-vercel--neon). The deploy procedure was rehearsed end to end on a clean database (section 9).

---

## 1. Implemented features

**Public site.** These pages are server-rendered and indexable, with real 404 status codes:
- Home, services, category pages and technician search, with filters for wilaya/commune, category, rating, availability day and emergency.
- Public technician profiles.
- How it works, become a technician, about, contact (stored in the DB), FAQ, privacy and terms.
- Login, registration, password reset, e-mail verification and the offline page.

**Accounts and security**
- Custom auth: bcrypt (cost 11), DB-backed sessions (only a SHA-256 of the cookie token is stored), httpOnly/SameSite cookies.
- Session revocation on suspension and password change.
- Rate limits stored in Postgres: login, registration, reset, quotes, messages, uploads, contact.
- Six roles: guest, client, technician, support_agent, administrator, super_administrator.
- Permission map enforced server-side in every action and route; privilege escalation is blocked (`canGrantRole`).
- There is no public admin signup and no hard-coded credentials.
- Security headers: Content-Security-Policy (`frame-ancestors 'none'`, `object-src 'none'`), HSTS, nosniff, Referrer-Policy, Permissions-Policy.
- An audit log, append-only by DB trigger, covers sensitive actions, including every access to identity documents.

**Client space** (`/client/*`)
- Dashboard, search and favourites.
- A 4-step request wizard with inline address and photos. A request is matched only to approved technicians who serve the commune.
- Quotes are compared side by side. The total is always recomputed on the server; accepting a quote atomically rejects the competing ones.
- Fixed-price direct booking with a slot hold.
- Bookings with cancellation and reschedule requests (within the window set in Settings) and confirmation of completion.
- Reviews: one per completed booking. Ratings show an average only from 3 reviews.
- Disputes with evidence, chat, notifications, addresses, profile, settings, support tickets and data export (JSON).

**Technician space** (`/technicien/*`)
- Onboarding: profile → categories and zones (58 wilayas / 1541 communes) → services and prices → weekly availability and exceptions → identity and qualification documents → submission.
- Verification status page.
- Matched requests with a quote builder (line items, revisions, withdrawal).
- Booking lifecycle: confirmed → en route → in progress → awaiting confirmation → completed (auto-close if the client doesn't respond).
- Cash recorded once per booking, with a ledger.
- Earnings, reviews, chat, portfolio and notifications.

**Administration** (`/admin/*`, 15 modules)
- Overview built from live DB counts only.
- Users (suspend/reactivate, role grants within your level) and technicians.
- Verification queue with document review: approve, request changes or reject, with reasons.
- Categories (FR/AR, activate) and services.
- Bookings, with a status override that requires a written reason.
- Disputes (staff-only resolution), reports, reviews (hide/restore), support tickets.
- Notification templates and delivery log; reports with CSV exports; audit log.
- Platform settings: commission (0 % at launch), cancellation window, quote validity, maintenance mode, active wilayas.

**Data integrity in PostgreSQL**
- A `btree_gist` EXCLUDE constraint prevents overlapping bookings for a technician.
- The technician row is locked (`FOR UPDATE`) during slot checks; concurrent double-booking is covered by a test.
- CHECK constraints keep quote totals consistent.
- Partial unique indexes: one accepted quote per request, one booking per request, one open dispute per booking.
- Append-only triggers on `audit_logs`, `ledger_entries`, `booking_status_history` and `verification_reviews`.
- Money is stored as integer minor units (DZD) and displayed as `2 500 DA`.
- Times use Africa/Algiers (UTC+1, no DST).

**Files.** Private storage in Postgres (`bytea`), served only through the authorized `/api/files/[id]`. Uploads are checked by magic bytes and size, and images are re-encoded to WebP with `sharp`, which strips EXIF/GPS. The client's address stays hidden from technicians until a booking is confirmed.

**Notifications.** Always stored in-app, with an unread badge and per-user preferences. E-mail (Resend) and SMS (Twilio) adapters record each delivery attempt. When a provider is not configured, deliveries are recorded honestly as `skipped_not_configured`, and the admin dashboard shows *Non configuré*.

**E-mail verification codes.** While an e-mail sender is configured:
- **Sign-up:** a 6-digit code is e-mailed and the account opens only once it is entered. E-mail is required at sign-up.
- **Sign-in:** a code is required the first time on each device; the device is then trusted for 30 days.
- **Limits:** codes are stored hashed, valid 10 minutes, burned after 5 wrong attempts, with a 60 s resend cooldown and at most 5 sends.
- **Resets:** changing or resetting the password forgets all trusted devices.
- **No sender configured:** codes are off and login works with the password alone. This means a missing e-mail setup can never lock anyone out.

**Chat.** Conversations per request or booking, with attachments, blocking and reporting. New messages arrive by polling (no websockets).

**PWA.** Manifest, icons (including maskable) and a service worker that caches only public static assets and never private pages or the API. Offline banner, offline page, and forms refuse to submit while offline.

**i18n.** FR and AR dictionaries with 1 292 keys in parity, verified by `npm run i18n:check`. Arabic renders RTL with Noto Sans Arabic. The language switch keeps typed input.

## 2. Technology stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.4 (App Router, Server Actions, Turbopack), React 19.3, TypeScript |
| Styling | Tailwind CSS v4 (CSS-first `@theme`, logical properties, `rtl:` variant); primary `#146B52`; Inter + Noto Sans Arabic (self-hosted via Fontsource) |
| Database | PostgreSQL 16 · Drizzle ORM 0.45 · `postgres` driver (`prepare: false`, pooler-safe) |
| Validation | Zod 4 (errors are i18n keys) · libphonenumber-js (Algerian mobiles, E.164) |
| Files | Postgres `bytea` + `file-type` + `sharp` |
| Background work | Vercel Cron (`/api/cron/all`, daily) + opportunistic maintenance via `after()` at most every 5 min |
| Tests | Vitest (unit + integration on a real Postgres) · Playwright (E2E on a production build) |

## 3. Local development

Requires Node ≥ 20.9 and PostgreSQL ≥ 14. The `btree_gist` extension is created by the migration.

```bash
npm install
cp .env.example .env            # set DATABASE_URL, NEXT_PUBLIC_APP_URL=http://localhost:3000, CRON_SECRET
npm run db:migrate              # schema + constraints + triggers
npm run db:seed                 # reference data only: 58 wilayas, 1541 communes, 10 categories, default settings (idempotent)
npm run db:seed:demo            # OPTIONAL, dev only: "[DÉMO]" accounts @demo.khidmati.test (refuses to run in production)
npm run dev
```

## 4. Provisioning the first administrator

There is no public admin signup. Either option makes one account **super_administrator**; the action is recorded in the audit log. Further staff (support agents, administrators) are then granted from **Admin → Utilisateurs**, and a role can only be granted by someone holding a higher one.

**Option A: web setup (no terminal)**
1. Create your normal account on the live site (`/inscription`).
2. In Vercel, add the environment variable `SETUP_TOKEN` with 32+ random characters, then redeploy.
3. While signed in, open `/installation`, paste the same code and confirm. You land in `/admin`.

The page only works while no super administrator exists. It is rate-limited and compares the code in constant time, and two simultaneous claims cannot both succeed. Once used it returns 404 permanently, and you can delete `SETUP_TOKEN` afterwards.

**Option B: command line**

```bash
DATABASE_URL="<production url>" ADMIN_EMAIL=you@example.com ADMIN_NAME="Prénom Nom" npm run admin:create
```

This creates the account and prints a random one-time password once; change it at first login (Paramètres → Sécurité). If the account already exists, it only grants the role.

## 5. Environment variables

The values live in `.env` locally or in Vercel project settings, never in git. See `.env.example`.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection (pooled URL on Neon) |
| `DATABASE_URL_UNPOOLED` | recommended | Direct URL for migrations, seed and admin script (falls back to `DATABASE_URL`) |
| `NEXT_PUBLIC_APP_URL` | yes | Public base URL |
| `CRON_SECRET` | yes | Protects `/api/cron/*`; Vercel Cron sends it automatically |
| `SETUP_TOKEN` | once | One-time `/installation` code for the first super administrator (32+ chars); delete after use |
| `DATABASE_POOL_MAX` | no | Connections per instance (default 5) |
| `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM_ADDRESS` | no | Resend e-mail |
| `SMTP_USER`, `SMTP_PASSWORD` (+ optional `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`) | no | SMTP e-mail, e.g. Gmail with an App password (defaults to smtp.gmail.com:465) |
| `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `SMS_PROVIDER_API_KEY`, `SMS_SENDER_ID` | no | Twilio SMS |
| `DEV_EMAIL_CONSOLE` | dev only | Print e-mails to the console (inactive in production) |

## 6. Integrations still requiring credentials

| Integration | Status | What's needed |
|---|---|---|
| **PostgreSQL (production)** | **Blocking**: not provisioned | Neon (or any Postgres ≥ 14) URL |
| E-mail (Gmail SMTP or Resend) | Adapters implemented. SMTP was tested end to end against a local SMTP server; **not yet configured or tested with your real Gmail** | Gmail address + App password (`SMTP_USER`, `SMTP_PASSWORD`), or Resend API key + verified domain |
| SMS (Twilio) | Adapter implemented, **not configured, not tested against the live API** | Twilio SID, auth token, sender ID / number enabled for +213 |
| Push notifications | Not implemented (shown as *Non configuré*) | — |
| Online payments | **Not integrated by design**: cash only, recorded by the technician | — |
| Maps / geolocation | Not integrated: wilaya and commune are chosen manually | Optional future provider |
| Identity checks | Manual review of uploaded documents by staff; no automated KYC provider | Optional future provider |

Without credentials, e-mail-dependent flows (verification link, password reset) still create their tokens and in-app notifications. The e-mail itself is not sent, and the delivery is recorded as `skipped_not_configured`.

## 7. Deployment (Vercel + Neon)

`vercel.json` sets the build to `npm run vercel-build` (= migrate → reference seed → `next build`, all idempotent) and a daily cron (`15 3 * * *`, compatible with the Hobby plan).

The commands below run from the project folder on your computer (Node ≥ 20.9). Use your own Vercel login.

1. **Create the project without deploying it yet:** `npx vercel@latest link`. Answer *No* to "link to existing project", name it `khidmati-dz`, and keep the detected settings (Next.js).
2. **Database:** in the Vercel dashboard, open **khidmati-dz → Storage → Create Database → Neon** (the free plan is enough to start), then **Connect** it to the project for all environments. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. **Other variables:**
   ```bash
   npx vercel env add NEXT_PUBLIC_APP_URL production   # e.g. https://khidmati-dz-youyoujosef18-7672s-projects.vercel.app (Project → Domains shows the real one)
   openssl rand -hex 32 | npx vercel env add CRON_SECRET production
   ```
4. **Deploy:** run `npx vercel --prod`. The build migrates the database and seeds the reference data. Then check that `GET /api/health` returns `"status":"ok"` and `"database":"ok"`.
5. **First administrator:**
   ```bash
   npm install
   npx vercel env pull .env --environment=production   # writes DATABASE_URL locally (.env is git-ignored; delete it afterwards)
   ADMIN_EMAIL=you@example.com ADMIN_NAME="Prénom Nom" npm run admin:create
   ```
6. Smoke test: register a client and a technician, approve the technician as admin, then request → quote → accept → complete → review.
7. Optional: add the Resend and Twilio variables and redeploy. Send yourself a test via a password reset, then check **Admin → Notifications** for `sent`.

Hobby plan note: the cron runs once a day. Time-based housekeeping (expiring quotes and holds, auto-closing jobs, reminders) also runs opportunistically on incoming traffic, at most every 5 minutes. On Pro you can add an hourly cron to `/api/cron/hourly`.

## 8. Commands

```bash
npm run dev | build | start
npm run typecheck            # tsc --noEmit
npm run lint                 # eslint
npm run i18n:check           # FR/AR key parity + every literal key resolves
npm run db:generate          # drizzle-kit (after schema changes)
npm run db:migrate | db:seed | db:seed:demo | admin:create
npm run test:unit            # Vitest unit tests
npm run test:integration     # needs a Postgres; recreates the "khidmati_test" database
npm run test:e2e             # Playwright against E2E_BASE_URL (default http://localhost:3100)
                             # needs E2E_ADMIN_PASSWORD for an admin created with admin:create
```

## 9. Test results (executed 2026-10-14, local)

| Suite | Result |
|---|---|
| TypeScript `tsc --noEmit` | ✅ 0 errors |
| ESLint | ✅ 0 problems |
| i18n parity | ✅ 1 292 keys, FR/AR in sync |
| Vitest unit (4 files) | ✅ 33/33 |
| Vitest integration (real PostgreSQL 16) | ✅ 32/32 |
| Production build (`next build`) | ✅ |
| Playwright E2E on the production build (Chromium) | ✅ 6/6 |
| Visual QA sweep: 33 pages × FR/AR × 1280 px / 390 px (132 renders) | ✅ no console errors, no horizontal overflow, correct `dir`, h1 present |
| Clean-room deploy rehearsal: delivered package → `npm ci` → `npm run vercel-build` on an **empty** database → `admin:create` → server start | ✅ health `ok`, cron rejects missing secret (401), Playwright E2E 6/6 on that build |

**Integration tests cover:**
- Auth, duplicate accounts, and suspension revoking sessions.
- Blocked privilege escalation.
- Verification flow and document privacy (support agents cannot read identity documents).
- Upload content validation.
- Matching and idempotency.
- Quote eligibility, server-side totals and revisions.
- Atomic acceptance and rejection of competing quotes.
- **Concurrent double booking prevented**, plus the DB exclusion constraint.
- Full lifecycle with cash recorded once, history and review.
- Cancellation window; reschedule only after acceptance.
- Fixed-price hold expiry.
- Staff-only dispute resolution.
- Chat authorization.
- Honest delivery states.
- Append-only tables.
- Photo access and prevention of attachment theft.
- Address hidden before confirmation.

**E2E journeys:**
1. Anonymous and role redirects.
2. Technician signup and full onboarding through the UI, including document upload.
3. Admin approval, with audit entries and sensitive-access logging.
4. Client search → request → technician quote (address hidden) → acceptance → chat → en route / start / done → client confirmation → review. Another client cannot see the booking.
5. Arabic RTL, with form input preserved on language switch.
6. No mobile overflow.

## 10. Known limitations and open items

- **Not deployed**: no production database has been provisioned. The Vercel connector used during development had read-only access (project and deployment creation returned 403), so the deploy has to be run from your account (section 7).
- E-mail and SMS are not configured, so they have **not been verified with real providers**.
- Payments are cash-only; there is no payment gateway and no push notifications.
- Chat uses polling, not realtime.
- There is no map or geolocation: the location is chosen manually (wilaya → commune).
- The geographic dataset (58 wilayas / 1 541 communes) comes from the open `othmanus/algeria-cities` data. Check it against any later administrative reorganization before launch. Wilayas can be deactivated from Admin → Paramètres.
- The legal pages (privacy, terms) are **drafts that must be reviewed by an Algerian lawyer**, including against Law 18-07 on personal data.
- File storage in Postgres suits launch volumes. Move to an object store if uploads grow large.
- Private dashboard pages stream behind a loading boundary, so their "not found" responses return HTTP 200 with `noindex` instead of 404. Public pages return real 404s.
