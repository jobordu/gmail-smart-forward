# Gmail Smart Forward

Automatically forward receipts and invoices from approved suppliers to a target email address (e.g. Revolut, accounting inbox).

Runs entirely in Google Apps Script — no server required.

---

## How it works

1. **Discovery** — scans 365 days of Gmail to surface likely supplier senders
2. **Allowlist** — you manually approve senders/domains
3. **Dry-run backfill** — previews what would be forwarded, no emails sent
4. **Real backfill** — forwards approved historical receipts
5. **Live mode** — time-driven trigger processes new emails every 15 minutes

---

## Setup

### 1. Prerequisites

Install Node.js (v18+), then:

```bash
npm install
npm install -g @google/clasp
```

### 2. Enable the Apps Script API

Visit **https://script.google.com/home/usersettings** and enable the **Google Apps Script API** toggle.

### 3. Log in to clasp

```bash
clasp login
```

A browser window will open. Sign in with your Google account and approve the requested permissions.

### 4. Create the Apps Script project

```bash
clasp create --title "Gmail Smart Forward" --type standalone --rootDir src
```

This creates the project in your Google account and writes `.clasp.json` with the script ID.

> **Opening the editor:** `clasp open` may not work in v3. Use the direct URL from `.clasp.json`:
> `https://script.google.com/d/<scriptId>/edit`
>
> If you're signed into multiple Google accounts and get an "access denied" page, append
> `?authuser=0`, `?authuser=1`, etc. until you land on the right account. Incognito with
> only the target account signed in is the most reliable workaround.

### 5. Configure your .env

```bash
cp .env.example .env
```

Edit `.env` — at minimum set:

```
FORWARD_TO_EMAIL=helene@example.com
```

Leave `ALLOWED_SENDERS` and `ALLOWED_DOMAINS` blank for now — you'll fill these in after discovery.

### 6. Build and push

```bash
npm run push
```

This runs `build-env` (generates `src/_env.js` from `.env`) then pushes all files to Apps Script.

### 7. Bootstrap Script Properties

Open the Apps Script editor:

```bash
clasp open
```

In the editor, select `bootstrapProperties` from the function dropdown and click **Run**.

This writes all values from `.env` into Script Properties (the runtime config store) and creates the Gmail labels.

---

## Workflow

### Phase 1 — Discovery

Run `discoverSuppliers()` in the Apps Script editor.

Check the execution log. You'll see a ranked list of senders with:
- total emails
- PDF attachment count
- sample subjects
- matched keywords
- first/last seen dates

### Phase 2 — Build your allowlist

Edit `.env` and fill in the senders/domains you trust:

```
ALLOWED_SENDERS=billing@stripe.com,noreply@shopify.com
ALLOWED_DOMAINS=xero.com,quickbooks.com
```

Then push the updated config:

```bash
npm run push
```

Run `bootstrapProperties()` again in the Apps Script editor to apply the new values.

### Phase 3 — Dry-run backfill

Run `dryRunBackfill()` in the Apps Script editor.

Check the log — it shows exactly which emails would be forwarded and why each rejection was made. No emails are sent.

### Phase 4 — Real backfill

When the dry-run output looks correct, set in `.env`:

```
DRY_RUN=false
```

Then:

```bash
npm run push
```

Run `bootstrapProperties()` in the editor, then run `backfillApprovedSuppliers()`.

All forwarded threads are labeled `revolut-forwarded` for idempotency.

### Phase 5 — Live mode

Set in `.env`:

```
ENABLE_LIVE_FORWARDING=true
```

Then:

```bash
npm run push
```

Run `bootstrapProperties()`, then run `setupTrigger()` in the editor.

This installs a time-driven trigger that calls `processLiveEmails()` every 15 minutes.

To stop live forwarding at any time, run `removeTrigger()` in the editor.

---

## Gmail labels

| Label | Purpose |
|---|---|
| `revolut-candidate` | Coarse filter target |
| `revolut-forwarded` | Idempotency — never forwarded twice |
| `revolut-rejected` | Debugging and review |
| `revolut-discovered` | Historical analysis tagging |

---

## Config reference

All values live in `.env` locally. After editing, always run `npm run push` then `bootstrapProperties()`.

| Key | Default | Description |
|---|---|---|
| `FORWARD_TO_EMAIL` | *(required)* | Target email address |
| `ALLOWED_SENDERS` | *(empty)* | Comma-separated approved emails |
| `ALLOWED_DOMAINS` | *(empty)* | Comma-separated approved domains |
| `EXCLUDED_SENDERS` | *(empty)* | Always block these senders |
| `EXCLUDED_DOMAINS` | *(empty)* | Always block these domains |
| `DISCOVERY_DAYS` | `365` | How many days back to scan |
| `BACKFILL_AFTER_DATE` | `2025/04/10` | Backfill window start (YYYY/MM/DD) |
| `DRY_RUN` | `true` | Set to `false` to forward for real |
| `MAX_EMAILS_PER_RUN` | `50` | Rate limit per execution |
| `ENABLE_LIVE_FORWARDING` | `false` | Enable the live trigger |

---

## Dev workflow

```bash
# Edit code locally
git checkout -b feature/my-change

# Build env + push to Apps Script
npm run push

# Test in the Apps Script editor, then commit
git commit -m "..."
```

View live logs:

```bash
npm run logs
```
