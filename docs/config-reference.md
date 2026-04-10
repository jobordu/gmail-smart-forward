# Config Reference

All values live in `.env` locally. After any edit, run `npm run push` then `bootstrapProperties()` in the Apps Script editor.

## Variables

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
| `CANDIDATE_LABEL` | `gmail-smart-forward/candidate` | Gmail label for candidate threads |
| `FORWARDED_LABEL` | `gmail-smart-forward/forwarded` | Gmail label for forwarded threads |
| `REJECTED_LABEL` | `gmail-smart-forward/rejected` | Gmail label for rejected threads |
| `DISCOVERED_LABEL` | `gmail-smart-forward/discovered` | Gmail label for discovered threads |

## Gmail labels

All labels are nested under `gmail-smart-forward/` and visible as a group in Gmail's sidebar.

| Label | Purpose |
|---|---|
| `gmail-smart-forward/forwarded` | Idempotency — thread will never be forwarded again |
| `gmail-smart-forward/rejected` | Thread was evaluated and skipped |
| `gmail-smart-forward/candidate` | Coarse filter target |
| `gmail-smart-forward/discovered` | Historical analysis tagging |

## Maintenance

**Adding a new supplier**

1. Add their email to `ALLOWED_SENDERS` in `.env`
2. `npm run push`
3. In the editor: `setup.gs` → `bootstrapProperties` → Run
4. In the editor: `backfill.gs` → `backfillApprovedSuppliers` → Run (picks up any past emails from them)

**Resetting all labels (fresh backfill)**

In the editor: `setup.gs` → `clearAllLabels` → Run

This strips all labels from tagged threads without deleting the label objects. Run before a fresh backfill after major allowlist changes.

**Migrating label names**

If you change label names in `.env`, run `bootstrapProperties` first (creates new labels), then `migrateLabels` (moves all threads from old labels to new ones). Manually delete the old labels in Gmail Settings → Labels afterward.

**Stopping the live trigger**

In the editor: `setup.gs` → `removeTrigger` → Run
