# Changelog

All notable changes to this project will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-04-10

### Added
- Discovery: scans Gmail history to surface likely supplier senders ranked by PDF count and recency
- Allowlist-based forwarding: only emails from approved senders with PDF attachments are forwarded
- Per-message forwarding: each qualifying message forwarded individually, not the whole thread
- Dry-run mode: full preview of what would be forwarded with no emails sent
- Historical backfill: processes up to 1000 candidate threads per run with random shuffle for fair coverage
- Live mode: time-driven trigger runs `processLiveEmails()` every 15 minutes
- Idempotency: forwarded and rejected threads labeled so they are never re-processed
- `clearAllLabels()`: reset all labels for a fresh start (e.g. when changing target email)
- `migrateLabels()`: rename labels without losing thread history
- Auto-computed `BACKFILL_AFTER_DATE` from `DISCOVERY_DAYS` if not explicitly set
- Bilingual PT/EN invoice keyword vocabulary for subject and attachment matching
- Configurable attachment extension allowlist (`ATTACHMENT_EXTENSIONS`)
- Nested Gmail labels under `gmail-smart-forward/`
- gitleaks pre-commit hook and CI workflow for secret scanning
- Branch protection on `main`
- Claude Code onboarding prompt (`onboard.md`) for guided setup
- Full rollout guide (`docs/rollout-guide.md`) and config reference (`docs/config-reference.md`)
