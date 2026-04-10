# Gmail Smart Forward

## What This Is

A serverless Gmail forwarder built on Google Apps Script that automatically forwards emails from allowlisted senders matching keyword and attachment criteria to a target inbox. No external services, no hosting cost — runs entirely on a free personal Gmail account. The next milestone focuses on making configuration dramatically easier: replacing manual .env editing and Apps Script function runs with a guided, interactive experience.

## Core Value

Every forwarded email is one the user actually wanted — zero false positives, zero missed emails — set up without needing to touch code.

## Requirements

### Validated

- ✓ Sender allowlist (by specific email or domain) — existing
- ✓ Keyword matching on subject lines in 7 languages (EN, FR, ES, PT, DE, ZH, JA) — existing
- ✓ Keyword matching on attachment filenames in 7 languages — existing
- ✓ Attachment type filtering (PDF by default, configurable) — existing
- ✓ Dry-run backfill (preview without sending) — existing
- ✓ Real backfill of historical emails — existing
- ✓ Live mode via 15-min time-driven trigger — existing
- ✓ Gmail labels for idempotency (candidate, forwarded, rejected, discovered) — existing
- ✓ Supplier discovery from Gmail history — existing
- ✓ Excluded keyword list to filter noise — existing
- ✓ Claude Code onboarding prompt for guided setup — existing
- ✓ Git-based dev workflow with clasp push — existing

### Active

- [ ] Interactive CLI wizard for first-time setup (replaces manual .env editing)
- [ ] In-script allowlist management without touching .env (add/remove senders from Apps Script editor)
- [ ] Guided dry-run review with structured output (replace raw execution log parsing)
- [ ] Config validation with clear error messages before push
- [ ] One-command rollout progression (preview → backfill → live as a single guided flow)
- [ ] Status command showing current mode, trigger state, and label counts

### Out of Scope

- Web application / browser UI — requires external hosting, violates the "no external services" constraint
- OAuth / multi-account management — complexity out of proportion to benefit for personal use
- Real-time forwarding (push notifications) — Apps Script time-driven triggers are sufficient and simpler
- AI-based classification — keyword matching is intentional (user controls exactly what forwards)

## Context

The tool works today and is production-ready for technical users. The pain point is setup friction: users must manually edit .env files, understand clasp, navigate the Apps Script editor to run specific functions in the right order, and interpret raw execution logs. The onboarding prompt (onboard.md) patches this with a Claude Code session, but a proper interactive experience built into the tool itself would remove the dependency on AI-assisted setup entirely.

Stack: Google Apps Script (ES5-compatible JavaScript), clasp for deployment, Node.js scripts for build tooling. The constraint is Apps Script — no npm packages available at runtime, no async/await, no modules.

## Constraints

- **Tech stack**: Google Apps Script (ES5 only) at runtime — no modern JS features, no npm packages, no async
- **Deployment**: clasp v3+ required for push; users must have Apps Script API enabled
- **Auth**: Apps Script handles Gmail OAuth — no additional auth infrastructure needed
- **Hosting**: None — everything runs in Google's infrastructure
- **Compatibility**: Must work with a free personal Gmail account

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No external hosting | Keeps the tool free and simple for personal use | ✓ Good |
| ES5-only Apps Script | Google's runtime constraint — cannot use modern JS | ✓ Good — accepted |
| Keyword matching over ML | User needs deterministic control over what forwards | ✓ Good |
| .env → Script Properties pattern | Keeps secrets out of source, clasp handles deployment | ✓ Good — keep for now |
| Interactive CLI wizard | Best UX improvement within Node.js tooling layer | — Pending |

---
*Last updated: 2026-04-10 after initialization*
