# Gmail Smart Forward

> [!TIP]
> **Get started — give this prompt to your coding agent:**
> ```
> Clone https://github.com/jobordu/gmail-smart-forward, then read onboard.md at the root — it contains your full instructions for onboarding me through this tool.
> ```

---

A serverless Gmail forwarder with sender allowlist, keyword matching, and attachment filtering. Google-only — no external services, no server, no hosting cost. Works on a free personal Gmail account.

Configure it for any forwarding use case. The default ships with a multilingual invoice vocabulary across 7 languages (EN, FR, ES, PT, DE, ZH, JA) oriented toward a company tracking its outgoing spend — supplier invoices, subscription receipts, payslips. Your coding agent will ask about your use case and generate the right keywords in the right language during onboarding.

---

## How it works

1. **Discovery** — scans your Gmail history to surface likely senders matching your use case
2. **Allowlist** — you manually approve which senders to trust
3. **Keyword matching** — subject and attachment filename keywords filter by use case and language
4. **Attachment filtering** — only threads with an allowed file type (PDF by default) qualify
5. **Dry-run backfill** — previews what would be forwarded, no emails sent
6. **Real backfill** — forwards approved historical emails
7. **Live mode** — time-driven trigger processes new emails every 15 minutes

Only emails from allowlisted senders that match your keywords and contain an allowed attachment are forwarded. Each qualifying message is forwarded individually (not the whole thread). Forwarded and rejected threads are labeled for idempotency — running the backfill twice is safe.

---

## Safety states

You progress through three states during rollout. Never skip ahead.

| State | `DRY_RUN` | `ENABLE_LIVE_FORWARDING` | What happens |
|---|---|---|---|
| 1 — Preview | `true` | `false` | Nothing is sent. Logs show what *would* be forwarded. |
| 2 — Backfill | `false` | `false` | Historical emails are forwarded. No live trigger yet. |
| 3 — Live | `false` | `true` | New emails are forwarded automatically every 15 min. |

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
npm install -g @google/clasp   # requires clasp v3+
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
