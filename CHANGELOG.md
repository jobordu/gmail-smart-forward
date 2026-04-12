# Changelog

All notable changes to this project will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.2.0] — 2026-04-12

### Added
- README badges for license, version, test count, and coverage
- Release process documentation in DEVELOPMENT.md

### Fixed
- Eliminated all 26 ESLint `no-unused-vars` warnings by adding `sourceType: 'script'` and `/* exported */` directives for GAS global-scope declarations
- `llm.js` coverage improved from 94% to 100% — fixed `mockDriveApp.createFile` mock missing `setTrashed` method
- `package.json` version synced to match latest release tag (was 1.0.0, should have been 1.1.0)

---

## [1.1.0] — 2026-04-11

### Added
- LLM invoice classification: optional AI-based verification using vision models (email body + PDF) via any OpenAI-compatible provider
- Full test suite: 203 tests with 95%+ coverage across 13 test files, GAS mock system, and custom Jest transform
- ESLint setup with flat config (ESLint 9), `npm run lint` and `npm run lint:fix` scripts
- Pre-push git hook: gitleaks scans all commits before they reach the remote
- CI workflow for tests (`test.yml`): runs Jest on every push/PR to main
- CI workflow for lint (`lint.yml`): runs ESLint on every push/PR to main
- Release workflow (`release.yml`): auto-creates GitHub Releases from CHANGELOG.md on `v*` tag push
- `DEVELOPMENT.md`: architecture overview, data flow, testing guide, code style, dev workflow
- `CONTRIBUTORS.md`: contributor recognition
- `.github/FUNDING.yml`: GitHub Sponsors link
- `.github/CODEOWNERS`: automatic PR review assignments
- `.github/ISSUE_TEMPLATE/config.yml`: disables blank issues, points to Discussions
- GitHub Discussions enabled for community Q&A
- `.env.example` expanded with LLM config variables and provider options
- Denylist support: `EXCLUDED_SENDERS`, `EXCLUDED_DOMAINS`, `EXCLUDED_KEYWORDS`
- `ATTACHMENT_EXTENSIONS` config: configurable file type filter (default: `pdf`)

### Changed
- All GitHub Actions pinned to commit SHAs (not mutable tags) for supply chain security
- `install-hooks.sh` now installs both pre-commit and pre-push hooks
- Classifier excludes denylisted keywords for non-allowlisted senders only (avoids false positives on "Sales Invoice" from approved suppliers)
- Backfill supports per-sender processing via `backfillSender()`

### Removed
- Stale `.planning/` research and phase plan documents (project shipped, no longer needed)

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
