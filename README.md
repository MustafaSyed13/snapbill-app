# Snapbill — Invoicing made simple

A fully working, installable mobile invoicing app for freelancers, tradespeople, and small businesses. Create invoices, track payments, manage customers/products/packages, and get real business insights — backed by a real cloud database, private per account, and free to run.

**Live app:** https://mustafasyed13.github.io/snapbill-app/
**Repo:** https://github.com/MustafaSyed13/snapbill-app

---

## 1. What this is

- **Type:** Progressive Web App (PWA) — installs to your phone's home screen like a native app, no app store needed.
- **Frontend:** Vanilla JavaScript (ES modules), no build step, no framework. Runs on any static file host.
- **Backend:** [Supabase](https://supabase.com) — a hosted Postgres database + real authentication, free tier, no credit card. Every table has Row Level Security (RLS) enabled, so the database itself refuses to return another account's rows even if there were ever a bug in the app code.
- **Auth:** Real accounts via Supabase Auth (email + password), with real password-reset emails.
- **PDF & email:** Real client-side PDF generation (vendored `jsPDF` + `html2canvas`, MIT-licensed, downloaded once and cached — no ongoing paid service). "Email invoice" uses the native share sheet on phones (PDF auto-attached to a new email, one tap) with a download + `mailto` fallback on desktop.
- **Intelligence:** Rule-based/statistical engine for natural-language invoice creation, business Q&A, insights, and writing help — works without any external AI service. An optional AI key can be added later purely to improve phrasing (Account Settings → Optional AI assistant); nothing breaks without it.

---

## 2. Backend setup (Supabase) — one-time

1. Create a free account at https://supabase.com (no credit card) and a new project.
2. In the project dashboard, go to **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This creates all six tables (business, customers, items, packages, invoices, payments) with Row Level Security policies already wired up.
3. Go to **Authentication → Sign In / Providers → Email** and turn **off** "Confirm email" — this makes sign-up instant (no email round-trip needed to start using the app). You can turn this back on later for production if you want stronger verification.
4. Go to **Authentication → URL Configuration** and add your app's URL(s) to both **Site URL** and **Redirect URLs** — e.g. `https://mustafasyed13.github.io/snapbill-app/` (and `http://localhost:5500/` for local testing). This is required for password-reset email links to work.
5. Go to **Settings → API**, copy the **Project URL** and **anon/public key**, and paste them into the two constants at the top of `js/db.js` (`SUPABASE_URL` and `SUPABASE_ANON_KEY`). These two values are safe to embed in client-side code — they're not secrets, and access is enforced by the RLS policies from step 2, not by keeping the key hidden.

That's it — the same two values work for both local testing and the deployed site, since it's one shared cloud database.

---

## 3. Run it locally

Requirements: [Node.js](https://nodejs.org) (v18+).

```bash
cd "Invoice app"
npx serve . -l 5500
```

Open **http://localhost:5500**. An internet connection is required (the app talks to Supabase for every read/write).

**Demo account:** tap "Explore the demo" on the welcome screen, or sign in with:
- Email: `demo@snapbill.app`
- Password: `demo1234`

The first time anyone loads the demo account, the app automatically creates it and seeds a realistic business ("Rivera Studio") with invoices, customers, products, and packages spanning several months. After that, it's reused as-is (shared across everyone testing the live link, same as a real multi-user product).

---

## 4. Already deployed

The app is already live on GitHub Pages, pushed from this repo. To deploy your own changes:

```bash
git add -A
git commit -m "your message"
git push
```

GitHub Pages rebuilds automatically within about a minute of every push — no separate deploy step.

### Alternative free hosts (no credit card needed)
- **Cloudflare Pages**, **Netlify** — same idea, connect the GitHub repo, zero config. No code changes needed to switch.

---

## 5. Installing on a phone

**iPhone/iPad (Safari — required, other browsers can't do this step):**
1. Open the link in Safari.
2. Tap the Share button → **Add to Home Screen** → Add.
3. Snapbill now opens full-screen from the home screen, like a native app.

**Android (Chrome):**
1. Open the link in Chrome.
2. Tap the **⋮** menu → **Install app** (or "Add to Home screen").
3. Confirm.

**Desktop (Chrome/Edge):** click the install icon in the address bar.

A real downloadable app **file** (`.apk`/`.ipa`) is a separate, much bigger undertaking (Android needs the ~10GB SDK + Capacitor build; iPhone needs a $99/year Apple Developer account and isn't possible for free at all) — the install-to-home-screen approach above is the free, no-account equivalent and is what's shipped here. The in-app **Help & Install** screen (More → Help & install) repeats these steps for your friends.

---

## 6. Decisions made and why

| Area | Decision | Why |
|---|---|---|
| Frontend | Vanilla JS, no build step | Zero build tooling to break, deploys unchanged to any static host. |
| Backend | Supabase (Postgres + Auth) | Free forever tier, no credit card, real multi-device accounts, database-enforced privacy via RLS instead of trusting app code alone. |
| Distribution | PWA (installable web app) | Only free way to get "installable on iPhone + Android instantly, no app store." |
| PDF/invoice output | Client-side PDF generation (vendored jsPDF + html2canvas) | Real downloadable `.pdf` files and native "share to email" on phones, with zero ongoing service cost. |
| AI features | Offline rules/statistics engine, optional AI key hook | Guarantees the app **never breaks** if an AI service is down or a key isn't configured. |
| Payments | Manual recording only (cash/bank/card/etc.) | No paid payment processor needed for a prototype; architecture leaves room to add Stripe/PayPal later. |

---

## 7. Free-plan limitations (be upfront with testers)

- **Requires an internet connection.** Since data now lives in a real cloud database (this was an explicit upgrade from the original local-only version), there is currently no offline read/write cache — that's a good next addition if offline use matters to you (see roadmap).
- **Full account deletion is data-only.** "Delete account & data" wipes all business records (invoices, customers, etc.) from the database, but removing the underlying login itself requires elevated (service_role) access that the public app key intentionally cannot have. Reach the project owner (or use the Supabase dashboard → Authentication → Users) to fully remove a login shell if ever needed.
- **PDF export** is a rasterized image of the invoice embedded in a real PDF (not selectable text) — this keeps it pixel-perfect and free, at the cost of a slightly larger file size than a text-based PDF.
- **AI features are rule/statistics-based** by default (kept free and always-on). You can optionally connect your own AI API key in Account Settings for nicer phrasing on the writing tools.
- **Supabase's free tier** covers this app comfortably (500MB database, 50,000 monthly active users) but has some soft limits — see the expenses table below for when you'd outgrow it.

---

## 8. Backup and recovery instructions

- **Back up:** More → Export & backup → "Full backup (JSON)". Downloads everything (business profile, customers, items, packages, invoices, payments) in one file.
- **Restore:** More → Export & backup → "Restore" → choose the JSON file. Records are added to the currently signed-in account.
- **CSV exports** (invoices/customers/products) are also available for opening in Excel/Sheets.
- **Account data deletion:** More → Account settings → "Delete account & data" — offers to export a backup first, then permanently removes all business data from the cloud database (see the limitation above about the login shell itself).
- Supabase also keeps its own point-in-time backups on the project dashboard as an extra safety net.

---

## 9. What's NOT finished yet (production requirements)

This is a complete, functional prototype backed by a real database — but before real customers pay real invoices with it, you'd still want:

1. **Offline support** — a local cache + sync-on-reconnect layer so the app is still usable without a connection (the original local-only version had this; it was traded for real multi-device cloud sync in this version — both together is the natural next step).
2. **Full account deletion**, including the login itself, via a server-side function (Supabase Edge Function using the service_role key — never exposed to the browser).
3. **Real email delivery for reminders** — password reset already sends a real email via Supabase; invoice reminders/overdue notices are currently drafted for you to send manually.
4. **Online payment processing** (Stripe/PayPal) so customers can pay a link directly instead of manual payment recording.
5. **True native app store builds** (via Capacitor) if you want App Store/Google Play listings instead of a PWA.
6. **Stronger email verification** (re-enable "Confirm email" in Supabase Auth settings) once you're ready for production-grade signup.

---

## 10. Roadmap: prototype → commercial product

1. **Add an offline cache** (e.g. cache last-fetched data in IndexedDB, queue writes made while offline, sync on reconnect) — pairs the current cloud backend with the offline resilience the original version had.
2. **Server-side account deletion** via a Supabase Edge Function so "Delete account" also removes the login itself, not just the data.
3. **Add Stripe** (free to integrate, they take a per-transaction fee) for online invoice payments.
4. **Wrap with Capacitor** (https://capacitorjs.com) to produce real iOS/Android app binaries from this same codebase, then submit to the App Store ($99/yr) and Google Play ($25 one-time).
5. **Add transactional email** (invoice reminders, overdue notices) via Supabase's email hooks or a free tier of Resend/Postmark.
6. **Optionally upgrade the AI features** to a real LLM (already has a hook in Account Settings) for smarter natural-language parsing and writing assistance at scale.
7. **Re-enable email confirmation** in Supabase Auth settings for stronger signup verification once ready for real customers.

---

## 11. Expected future expenses (once you outgrow free tiers)

| Item | Free tier limit (typical) | Paid cost when you outgrow it |
|---|---|---|
| Supabase (DB + auth) | 500MB DB, 50k monthly active users | ~$25/mo Pro plan |
| Email sending (Resend/Postmark) | ~100–3,000 emails/mo free | ~$10–20/mo for a few thousand more |
| Stripe payment processing | Free to integrate | ~2.9% + $0.30 per transaction |
| Apple Developer Program | — | $99/year (required to publish on the App Store) |
| Google Play Developer | — | $25 one-time |
| Custom domain | — | ~$10–15/year |
| Hosting (GitHub/Cloudflare Pages) | Effectively unlimited for a static app | Free indefinitely at this scale |

Realistically, a small business could run this for **$0–10/month** until it has real paying customers, then costs scale with usage.

---

## 12. Upgrading services without losing data

Because Export/Restore uses a plain, documented JSON format (see `exportAccountData` in `js/db.js`), and the database schema is a plain SQL file (`supabase/schema.sql`), you're never locked in:

1. Export a full backup from the current setup (More → Export & backup).
2. Stand up the new service (e.g. a paid Supabase tier, or a different Postgres host).
3. Re-run (or adapt) `supabase/schema.sql` against the new database.
4. Restore the exported JSON into the new database.
5. Update `SUPABASE_URL` / `SUPABASE_ANON_KEY` in `js/db.js`, verify totals match the backup, then cut over.

This same pattern works for every future migration (new auth provider, new payment processor, new hosting) — always export first, verify the new system against the exported numbers, then cut over.

---

## 13. Project structure

```
index.html              App shell + PWA meta tags
manifest.webmanifest    PWA install manifest
sw.js                   Service worker (app-shell caching + auto-update)
styles.css              Full design system (light + dark themes)
assets/                 Generated app icons
supabase/schema.sql     Database schema + Row Level Security policies (run once in Supabase SQL Editor)
js/
  app.js                Router, layout, boot sequence, auth-event handling
  db.js                 Supabase client, auth, per-account data repositories, field mapping
  model.js              Invoice math, status logic, analytics engine
  intelligence.js       NL invoice parsing, business Q&A, insights, writing assistant
  invoice-doc.js        Invoice document rendering, real PDF generation, email sharing
  format.js             Currency/date formatting helpers
  seed.js               Demo account data generator
  lib.js                Tiny UI toolkit (hyperscript, router, icons, toasts, modals)
  screens-*.js          Each app screen, grouped by area
  vendor/               Locally-hosted third-party libraries (Supabase client, jsPDF, html2canvas) — downloaded once, no ongoing CDN dependency
tools/make-icons.js      Generates the PNG app icons (no dependencies)
```

No build step: edit any file, push, and GitHub Pages redeploys automatically.
