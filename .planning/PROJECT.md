# Gmail Smart Forward

## What This Is

A serverless Gmail forwarder built on Google Apps Script that automatically forwards emails from allowlisted senders matching keyword and attachment criteria to a target inbox. No external services, no hosting cost — runs entirely on a free personal Gmail account. Setup is handled by a coding agent that reads onboard.md and guides the user through each phase — no separate wizard needed.

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

- [ ] Status command showing current mode, trigger state, and label counts
- [ ] Config validation with clear error messages before push
- [ ] In-script allowlist management without touching .env (add/remove senders from Apps Script editor)

### Out of Scope

- Web application / browser UI — requires external hosting, violates the "no external services" constraint
- OAuth / multi-account management — complexity out of proportion to benefit for personal use
- Real-time forwarding (push notifications) — Apps Script time-driven triggers are sufficient and simpler
- AI-based classification — keyword matching is intentional (user controls exactly what forwards)
- Interactive CLI wizard — the agent-guided onboarding via onboard.md already covers this better than a Node CLI could

## Context

The tool works today and is production-ready for technical users. Setup friction is handled by the onboarding prompt (onboard.md), which guides a coding agent through the full rollout. The remaining gaps are runtime observability (status command) and safety nets (config validation) — things the agent can't provide once the user is running the tool on their own.

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
| Agent-guided onboarding over CLI wizard | Agent reads logs, adapts to errors, generates keywords — CLI can't match that | ✓ Good |
| .env → Script Properties pattern | Keeps secrets out of source, clasp handles deployment | ✓ Good — keep for now |

---
*Last updated: 2026-04-10 after initialization*
