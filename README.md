# Snapbill — Invoicing made simple

A fully working, installable mobile invoicing app for freelancers, tradespeople, and small businesses. Create invoices, track payments, manage customers/products/packages, and get real business insights — all working offline, private per account, and free to run.

---

## 1. What this is

- **Type:** Progressive Web App (PWA) — installs to your phone's home screen like a native app, works offline, no app store needed.
- **Stack:** Vanilla JavaScript (ES modules), no build step, no framework. Runs on any static file host.
- **Storage:** IndexedDB in the browser — private per account, works offline, no server required for the prototype.
- **Auth:** Real accounts with salted/hashed passwords (PBKDF2 via Web Crypto), password reset via security question.
- **Intelligence:** Rule-based/statistical engine for natural-language invoice creation, business Q&A, insights, and writing help — works 100% offline. An optional AI key can be added later purely to improve phrasing (see Account Settings → Optional AI assistant); nothing breaks without it.

---

## 2. Run it locally right now

Requirements: [Node.js](https://nodejs.org) (v18+).

```bash
cd "Invoice app"
npx serve . -l 5500
```

Open **http://localhost:5500** in a browser (or on your phone if it's on the same Wi-Fi — use your computer's local IP instead of `localhost`, e.g. `http://192.168.1.23:5500`).

**Demo account:** tap "Explore the demo" on the welcome screen, or sign in with:
- Email: `demo@snapbill.app`
- Password: `demo1234`

This loads a realistic pre-populated business ("Rivera Studio") with 12 invoices, 5 customers, products, and 2 packages spanning several months, so the dashboard and analytics are never empty.

---

## 3. Deploy for free so friends can install it

**GitHub Pages** is the recommended free host: no credit card, no time limit, reliable, and it's just serving these static files.

### One-time setup

1. Create a free GitHub account at https://github.com/join (if you don't have one).
2. Create a new **public** repository (e.g. `snapbill-app`) at https://github.com/new — don't initialize it with a README.
3. In this folder, run:

```bash
git add -A
git commit -m "Initial Snapbill app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/snapbill-app.git
git push -u origin main
```

4. On GitHub, go to your repo → **Settings → Pages**. Under "Build and deployment", set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`. Save.
5. Wait ~1 minute. Your app is now live at:

   **`https://YOUR_USERNAME.github.io/snapbill-app/`**

That URL is your shareable testing link — send it to friends. It updates automatically every time you `git push` new changes.

### Alternative free hosts (no credit card needed)
- **Cloudflare Pages** (pages.cloudflare.com) — connect the GitHub repo, zero config, generous free tier, custom domains free.
- **Netlify** (netlify.com) — drag-and-drop the folder in their dashboard, or connect via GitHub.

All three are static-file hosts, so no code changes are needed to switch between them.

---

## 4. Installing on a phone (for your friends)

**iPhone/iPad (Safari):**
1. Open the shared link in Safari.
2. Tap the Share button → **Add to Home Screen** → Add.
3. Snapbill now opens full-screen from the home screen, like a native app.

**Android (Chrome):**
1. Open the shared link in Chrome.
2. Tap the **⋮** menu → **Install app** (or "Add to Home screen").
3. Confirm. It installs with its own icon and opens full-screen.

**Desktop (Chrome/Edge):** click the install icon in the address bar, or the browser menu → "Install Snapbill".

The in-app **Help & Install** screen (More → Help & install) repeats these instructions for your friends.

---

## 5. Decisions made and why

| Area | Decision | Why |
|---|---|---|
| Framework | Vanilla JS, no build step | Zero build tooling to break, deploys unchanged to any static host, easiest to hand off or convert later. |
| Distribution | PWA (installable web app) | Only way to get "installable on iPhone + Android instantly, no app store" for free during a prototype. |
| Storage | IndexedDB (local) | Private per-device/per-account, offline-first, free, no backend to host or pay for. |
| Auth | Local accounts, PBKDF2 hashing | Real security without needing a paid auth provider; upgradeable to Supabase Auth later without changing the UI. |
| PDF/invoice output | Styled HTML → browser print-to-PDF + downloadable HTML | Works on every device without a paid PDF-rendering service; looks professional; upgradeable to server-side PDF generation later. |
| AI features | Offline rules/statistics engine, optional AI key hook | Guarantees the app **never breaks** if an AI service is down or a key isn't configured — a hard requirement in the brief. |
| Payments | Manual recording only (cash/bank/card/etc.) | No paid payment processor needed for a prototype; architecture leaves room to add Stripe/PayPal later. |

---

## 6. Free-plan limitations (be upfront with testers)

- **Data lives on-device** (browser storage), not synced to a cloud server yet. Each browser/device is its own copy. Use **More → Export & backup** to move data between devices (download JSON, then restore it on the other device).
- **No real-time multi-device sync.** If you use the app on your phone and your laptop, you'll need to export/import to keep them in sync (a cloud-sync upgrade is on the roadmap below).
- **PDF export** uses the browser's native print-to-PDF, not a dedicated PDF service — output is professional but you choose "Save as PDF" in the print dialog yourself.
- **AI features are rule/statistics-based**, not a large-language-model by default (kept free and always-on). You can optionally connect your own AI API key in Account Settings for nicer phrasing on the writing tools; this is optional and never required.
- **GitHub Pages** (or any static host) has no server-side code — this is fine for this app since all logic runs in the browser, but it means there's no way to enforce things like rate-limiting or server-side validation until a backend is added (see roadmap).

---

## 7. Backup and recovery instructions

- **Back up:** More → Export & backup → "Full backup (JSON)". This downloads everything (business profile, customers, items, packages, invoices, payments) in one file.
- **Restore:** More → Export & backup → "Restore" → choose the JSON file. Records are added to the currently signed-in account (safe to use on a fresh install or a different device).
- **CSV exports** (invoices/customers/products) are also available for opening in Excel/Sheets.
- Because everything lives in the browser's local database, **clearing your browser's site data/history will delete the data** — export a backup regularly if you're relying on the prototype for real record-keeping.
- **Account deletion:** More → Account settings → "Delete account & data" — offers to export a backup first, then permanently removes the account and all its data from the device.

---

## 8. What's NOT finished yet (production requirements)

This is a complete, functional prototype — but before real customers pay real invoices with it, you'd still need:

1. **Cloud database + multi-device sync** (e.g. Supabase/Firebase free tier) so a business's data isn't stuck on one device.
2. **Server-side auth** (currently client-side PBKDF2 in IndexedDB — fine for a single-device prototype, but a real product needs a proper auth backend so accounts survive a cleared browser and can be recovered via real email, not just a security question).
3. **Real email delivery** for password reset links, invoice emailing, and payment reminders (currently these are drafted for you to send manually/copy-paste).
4. **Online payment processing** (Stripe/PayPal) so customers can pay a link directly instead of manual payment recording.
5. **True native app store builds** (via Capacitor — see roadmap) if you want App Store/Google Play listings instead of a PWA.
6. **Server-side rate limiting / abuse protection** once there's a backend.
7. **Automated backups on the server side** (currently backup is a manual user action).

---

## 9. Roadmap: prototype → commercial product

1. **Add Supabase** (free tier, no credit card) as the cloud database + auth provider. The current `js/db.js` repository functions (`Customers`, `Items`, `Packages`, `Invoices`, `Payments`) are already structured as a clean data-access layer — swap their internals from IndexedDB calls to Supabase client calls without touching any screen code.
2. **Migrate existing local data** using the Export/Restore JSON format already built — write a one-time importer that reads a user's exported JSON and inserts it into Supabase on first cloud login.
3. **Add real email** (Supabase Auth handles this, or use a free tier of Resend/Postmark) for password reset and invoice sending.
4. **Wrap with Capacitor** (https://capacitorjs.com) to produce real iOS/Android app binaries from this same codebase — Capacitor wraps a PWA with minimal changes, then submit to the App Store ($99/yr) and Google Play ($25 one-time).
5. **Add Stripe** (free to integrate, they take a per-transaction fee) for online invoice payments.
6. **Add server-side PDF generation** (e.g. a small serverless function using a headless-Chrome PDF library) if you want branded PDF attachments emailed automatically.
7. **Optionally upgrade the AI features** to a real LLM (already has a hook in Account Settings) for smarter natural-language parsing and writing assistance at scale.

---

## 10. Expected future expenses (once you outgrow free tiers)

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

## 11. Upgrading services without losing data

Because Export/Restore uses a plain, documented JSON format (see `exportAccountData` in `js/db.js`), you're never locked in:

1. Export a full backup from the old setup.
2. Stand up the new service (e.g. Supabase).
3. Run a small import script (or, short term, use the in-app Restore feature once the cloud login flow exists) to load the JSON into the new store.
4. Point the app's repository functions at the new service.
5. Verify totals match the backup before decommissioning the old storage.

This same pattern works for every future migration (new auth provider, new payment processor, new hosting) — always export first, verify the new system against the exported numbers, then cut over.

---

## 12. Project structure

```
index.html              App shell + PWA meta tags
manifest.webmanifest    PWA install manifest
sw.js                   Service worker (offline cache + auto-update)
styles.css              Full design system (light + dark themes)
assets/                 Generated app icons
js/
  app.js                Router, layout, boot sequence
  db.js                 IndexedDB layer, auth, per-account data repositories
  model.js              Invoice math, status logic, analytics engine
  intelligence.js       NL invoice parsing, business Q&A, insights, writing assistant
  invoice-doc.js        Printable/downloadable invoice document generator
  format.js             Currency/date formatting helpers
  seed.js               Demo account data generator
  lib.js                Tiny UI toolkit (hyperscript, router, icons, toasts, modals)
  screens-*.js          Each app screen, grouped by area
tools/make-icons.js      Generates the PNG app icons (no dependencies)
```

No build step: edit any file and refresh the browser.
