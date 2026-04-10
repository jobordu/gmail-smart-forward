# Gmail Smart Forward

> [!TIP]
> **Get started — give this prompt to your coding agent:**
> ```
> Clone https://github.com/jobordu/gmail-smart-forward, then read onboard.md at the root — it contains your full instructions for onboarding me through this tool.
> ```

---

Automatically forward receipts and invoices from approved suppliers to a target email address (e.g. an accounting inbox, Revolut business email, or bookkeeper).

Runs entirely in Google Apps Script — no server, no hosting, no ongoing cost.

---

## How it works

1. **Discovery** — scans your Gmail history to surface likely supplier senders
2. **Allowlist** — you manually approve which senders to trust
3. **Dry-run backfill** — previews what would be forwarded, no emails sent
4. **Real backfill** — forwards approved historical receipts
5. **Live mode** — time-driven trigger processes new emails every 15 minutes

Only emails from allowlisted senders that contain a PDF attachment are forwarded. Each qualifying message is forwarded individually (not the whole thread). Forwarded threads are labeled for idempotency — running the backfill twice is safe.

---

## Rollout Guide

Follow these phases in order. Do not skip the dry-run — it is your safety net.

### What you need before starting

- A Google account (the one that receives invoices)
- The target email address where invoices should be forwarded
- Node.js v18+ installed locally
- A terminal

---

### Phase 0 — Install dependencies

```bash
git clone <this repo>
cd gmail-smart-forward
npm install
npm install -g @google/clasp
```

---

### Phase 1 — Google setup

**1.1 Enable the Apps Script API**

Visit **https://script.google.com/home/usersettings** and turn on the **Google Apps Script API** toggle. This is required for clasp to work. Without it, all clasp commands will fail.

**1.2 Log in to clasp**

```bash
clasp login
```

A browser window opens. Sign in with the Google account that receives invoices and approve the permissions. This creates a local credential file (`~/.clasprc.json`).

> If you have multiple Google accounts in your browser and land on the wrong one, use incognito mode with only the target account signed in.

**1.3 Create the Apps Script project**

```bash
clasp create --title "Gmail Smart Forward" --type standalone --rootDir src
```

This creates a new Apps Script project in your Google account and writes `.clasp.json` locally with the script ID. `.clasp.json` is gitignored — it belongs to your account, not the repo.

**1.4 Find your editor URL**

Open `.clasp.json` and copy the `scriptId`. Your editor URL is:

```
https://script.google.com/d/<scriptId>/edit
```

> If you see "You need access", append `?authuser=0` (or `?authuser=1`, `?authuser=2`) until you land on the right account.

---

### Phase 2 — Configure

**2.1 Create your .env**

```bash
cp .env.example .env
```

**2.2 Set required values**

Open `.env` and fill in at minimum:

```
FORWARD_TO_EMAIL=accounting@yourcompany.com   # where invoices get forwarded TO
```

Leave `ALLOWED_SENDERS` and `ALLOWED_DOMAINS` empty for now — you'll fill these in after discovery.

Leave `DRY_RUN=true` — do not change this yet.

**2.3 Push to Apps Script**

```bash
npm run push
```

This generates `src/_env.js` from your `.env` and pushes all files to Apps Script.

---

### Phase 3 — Bootstrap

Open the Apps Script editor and run `bootstrapProperties`:

1. Click **`setup.gs`** in the left file list
2. In the function dropdown (top toolbar, next to the Run button), select **`bootstrapProperties`**
3. Click **Run**
4. Approve Gmail permissions when prompted
5. Open **View → Execution log** — confirm you see `Config looks good.` and your `forwardToEmail` is correct

This writes your `.env` values into Script Properties (the runtime config store) and creates the Gmail labels.

> **Every time you edit `.env`**, you must run `npm run push` and then `bootstrapProperties` again for the changes to take effect.

---

### Phase 4 — Discovery

Run discovery to find which senders in your Gmail history look like suppliers:

1. Click **`discovery.gs`** in the file list
2. Select **`discoverSuppliers`** → click **Run**
3. Open **View → Execution log**

You'll see a ranked list of senders with email counts, PDF attachment counts, sample subjects, and date ranges. Review this list carefully.

**Build your allowlist**

From the discovery output, identify the senders you want to forward from. Edit `.env`:

```
ALLOWED_SENDERS=billing@stripe.com,invoices@aws.amazon.com,noreply@xero.com
ALLOWED_DOMAINS=
```

Guidelines:
- Add specific email addresses when a supplier uses a consistent sending address
- Add a domain only if you trust every address at that domain
- When in doubt, use the specific address, not the domain
- Do not add personal contacts, internal team addresses, or mailing lists

Then push and re-bootstrap:

```bash
npm run push
```

In the editor: **`setup.gs`** → **`bootstrapProperties`** → **Run**

---

### Phase 5 — Dry-run backfill

Run the dry-run to preview what would be forwarded. **No emails are sent.**

In the editor: **`backfill.gs`** → **`dryRunBackfill`** → **Run**

Open **View → Execution log** and review every `FORWARDED` entry:

- Is the sender correct? (should be one of your allowlisted suppliers)
- Does the subject look like an invoice or receipt?
- Does the date range look right?

Also review the `REJECTED` entries — if you see a legitimate supplier being rejected with `sender-not-allowlisted`, add them to `ALLOWED_SENDERS` and repeat this phase.

Common rejection reasons:
- `sender-not-allowlisted` — sender is not in your allowlist (expected for non-suppliers)
- `no-allowed-attachment` — no PDF in the thread (e.g. HTML-only invoice emails)
- `already-forwarded` — already processed in a previous run

**Iterate until the forwarded list looks exactly right before proceeding.**

---

### Phase 6 — Real backfill

When the dry-run output is clean, enable real forwarding:

**6.1 Edit `.env`**

```
DRY_RUN=false
```

**6.2 Push and re-bootstrap**

```bash
npm run push
```

In the editor: **`setup.gs`** → **`bootstrapProperties`** → **Run**

Confirm the execution log shows `"dryRun": false` in the config dump.

**6.3 Run the real backfill**

In the editor: **`backfill.gs`** → **`backfillApprovedSuppliers`** → **Run**

Check the execution log — you should see `FORWARDED` entries (without `dryRun: true`). Check the target inbox to confirm emails arrived.

The backfill is idempotent — running it again is safe. Already-forwarded threads carry the `gmail-smart-forward/forwarded` label and are excluded from future runs.

> If you have more than 200 candidate threads, run `backfillApprovedSuppliers` multiple times. Each run shuffles the candidate pool randomly, so all threads eventually get processed.

---

### Phase 7 — Live mode

Once the backfill looks good, enable the live trigger:

**7.1 Edit `.env`**

```
ENABLE_LIVE_FORWARDING=true
```

**7.2 Push and re-bootstrap**

```bash
npm run push
```

In the editor: **`setup.gs`** → **`bootstrapProperties`** → **Run**

Confirm `"liveForwarding": true` in the execution log.

**7.3 Install the trigger**

In the editor: **`setup.gs`** → **`setupTrigger`** → **Run**

This installs a time-driven trigger that calls `processLiveEmails()` every 15 minutes. You can verify it was created by clicking the **clock icon** (Triggers) in the left sidebar of the Apps Script editor.

**To stop live forwarding:** In the editor: **`setup.gs`** → **`removeTrigger`** → **Run**

---

### Rollout checklist

```
[ ] Node.js v18+ installed
[ ] clasp installed globally
[ ] Apps Script API enabled at script.google.com/home/usersettings
[ ] clasp login completed with the right Google account
[ ] clasp create ran, .clasp.json exists
[ ] .env created from .env.example
[ ] FORWARD_TO_EMAIL set
[ ] npm run push succeeded
[ ] bootstrapProperties ran, config looks correct
[ ] discoverSuppliers ran, reviewed output
[ ] ALLOWED_SENDERS / ALLOWED_DOMAINS populated
[ ] npm run push + bootstrapProperties ran again
[ ] dryRunBackfill ran, forwarded list reviewed and approved
[ ] DRY_RUN=false set in .env
[ ] npm run push + bootstrapProperties ran
[ ] backfillApprovedSuppliers ran, emails arrived at target inbox
[ ] ENABLE_LIVE_FORWARDING=true set in .env
[ ] npm run push + bootstrapProperties ran
[ ] setupTrigger ran, trigger visible in Apps Script Triggers panel
```

---

## Gmail labels

All labels are nested under `gmail-smart-forward/` and visible in Gmail's sidebar.

| Label | Purpose |
|---|---|
| `gmail-smart-forward/forwarded` | Idempotency — thread will never be forwarded again |
| `gmail-smart-forward/rejected` | Thread was evaluated and skipped |
| `gmail-smart-forward/candidate` | Coarse filter target |
| `gmail-smart-forward/discovered` | Historical analysis tagging |

---

## Config reference

All values live in `.env` locally. After any edit, run `npm run push` then `bootstrapProperties()` in the editor.

| Key | Default | Description |
|---|---|---|
| `FORWARD_TO_EMAIL` | *(required)* | Target email address invoices are forwarded to |
| `ALLOWED_SENDERS` | *(empty)* | Comma-separated approved sender emails |
| `ALLOWED_DOMAINS` | *(empty)* | Comma-separated approved sender domains |
| `EXCLUDED_SENDERS` | *(empty)* | Always block these senders |
| `EXCLUDED_DOMAINS` | *(empty)* | Always block these domains |
| `DISCOVERY_DAYS` | `365` | How many days back discovery and backfill scan |
| `BACKFILL_AFTER_DATE` | *(auto)* | Backfill window start (YYYY/MM/DD). Auto-computed as `today - DISCOVERY_DAYS` if not set. Override to pin a fixed date. |
| `DRY_RUN` | `true` | Set to `false` to forward for real |
| `MAX_EMAILS_PER_RUN` | `200` | Max threads processed per execution |
| `ENABLE_LIVE_FORWARDING` | `false` | Set to `true` to enable the live trigger |

---

## Maintenance

**Adding a new supplier**

1. Add their email to `ALLOWED_SENDERS` in `.env`
2. `npm run push`
3. In the editor: `setup.gs` → `bootstrapProperties` → Run
4. In the editor: `backfill.gs` → `backfillApprovedSuppliers` → Run (picks up any past emails from them)

**Migrating label names**

If you change label names in `.env`, run `bootstrapProperties` first (creates new labels), then `migrateLabels` (moves all threads from old labels to new ones). Manually delete the old labels in Gmail Settings → Labels afterward.

**Stopping the live trigger**

In the editor: `setup.gs` → `removeTrigger` → Run

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
