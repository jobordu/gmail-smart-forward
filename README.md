# Gmail Smart Forward

> [!TIP]
> **Get started — give this prompt to your coding agent:**
> ```
> Clone https://github.com/jobordu/gmail-smart-forward, then read onboard.md at the root — it contains your full instructions for onboarding me through this tool.
> ```

---

Automatically forward receipts and invoices from approved suppliers to a target email address (e.g. an accounting inbox, Revolut business email, or bookkeeper).

Runs entirely in **Google Apps Script** — no server, no hosting, no ongoing cost. Works on a free personal Gmail account.

---

## How it works

1. **Discovery** — scans your Gmail history to surface likely supplier senders
2. **Allowlist** — you manually approve which senders to trust
3. **Dry-run backfill** — previews what would be forwarded, no emails sent
4. **Real backfill** — forwards approved historical receipts
5. **Live mode** — time-driven trigger processes new emails every 15 minutes

Only emails from allowlisted senders that contain a PDF attachment are forwarded. Each qualifying message is forwarded individually (not the whole thread). Forwarded threads are labeled for idempotency — running the backfill twice is safe.

---

## Documentation

- [Rollout Guide](docs/rollout-guide.md) — step-by-step setup from clone to live
- [Config Reference](docs/config-reference.md) — all `.env` variables, labels, and maintenance tasks

---

## Quick start

```bash
git clone https://github.com/jobordu/gmail-smart-forward
cd gmail-smart-forward
npm install
npm install -g @google/clasp
npm run install-hooks
cp .env.example .env
# Edit .env, then:
npm run push
```

Then follow the [Rollout Guide](docs/rollout-guide.md).

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

```bash
# Scan for secrets manually
npm run secrets

# View live Apps Script logs
npm run logs
```

---

## License

MIT — Copyright (c) 2026 Jonathan Borduas
