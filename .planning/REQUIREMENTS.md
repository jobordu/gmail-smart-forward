# Requirements: Gmail Smart Forward — Better Configuration Experience

**Defined:** 2026-04-10
**Core Value:** Every forwarded email is one the user actually wanted — zero false positives, zero missed emails — set up without needing to touch code.

## Baseline Requirements

*Included from nForma baseline defaults (profile: cli). These are non-functional quality requirements.*

### UX
- [x] **UX-01**: CLI commands exit with non-zero code on error
- [x] **UX-02**: CLI commands print a usage hint when run with `--help`
- [x] **UX-03**: Destructive operations (file overwrites, state changes) require explicit confirmation
- [x] **UX-04**: Output is readable without color (for piped/non-TTY contexts)

### Reliability
- [x] **REL-01**: Existing .env file is preserved if wizard is cancelled mid-run
- [x] **REL-02**: All wizard operations are idempotent — safe to re-run
- [x] **REL-03**: Partial writes to .env are prevented (write atomically)

### Observability
- [x] **OBS-01**: Errors include enough context to self-diagnose (what failed, why, how to fix)
- [x] **OBS-02**: Verbose mode available (`--verbose`) for debugging

### CI/CD
- [x] **CI-01**: Existing `npm run push` continues to work unchanged (no breaking changes)
- [x] **CI-02**: New npm scripts do not conflict with existing ones

## v1 Requirements

### Setup Wizard

- [ ] **SETUP-01**: User can run `npm run setup` to start a guided first-time setup wizard
- [ ] **SETUP-02**: Wizard collects target email address with format validation before writing to .env
- [ ] **SETUP-03**: Wizard collects use case description and generates matching keywords for the specified languages
- [ ] **SETUP-04**: Wizard collects allowed sender email addresses with format validation
- [ ] **SETUP-05**: Wizard collects allowed file types (defaults to `pdf`)
- [ ] **SETUP-06**: Wizard shows a summary of all collected values before writing to .env (confirm step)
- [ ] **SETUP-07**: Wizard writes a complete, valid `.env` file from collected values
- [ ] **SETUP-08**: Wizard preserves comments and structure of `.env` when updating existing values

### Config Validation

- [ ] **CFG-01**: Running `npm run validate` checks .env for missing required keys and reports each issue clearly
- [ ] **CFG-02**: Config validation runs automatically before `npm run push` and fails fast with clear error message if invalid
- [ ] **CFG-03**: Email address values are validated as valid email format
- [ ] **CFG-04**: Boolean values (`DRY_RUN`, `ENABLE_LIVE_FORWARDING`) are validated as `true` or `false` string literals
- [ ] **CFG-05**: Validation error messages tell the user exactly which key is wrong and what the valid value looks like

### Rollout Guide (CLI)

- [ ] **ROLL-01**: User can run `npm run rollout` to enter a guided state-by-state rollout flow
- [ ] **ROLL-02**: Rollout command shows current state (State 1 Preview / State 2 Backfill / State 3 Live) at startup
- [ ] **ROLL-03**: Rollout command transitions to next state by updating .env, running push, and telling user what to do in the Apps Script editor
- [ ] **ROLL-04**: Rollout command refuses to skip states (e.g. cannot go Preview → Live without Backfill)
- [ ] **ROLL-05**: Rollout command shows exactly which Apps Script function to run and where to find it in the editor

### Status Command

- [ ] **STAT-01**: User can run `npm run status` to see current forwarding mode, DRY_RUN flag, ENABLE_LIVE_FORWARDING flag, and forward-to address
- [ ] **STAT-02**: Status command shows which rollout state the configuration is in (1/2/3) with a plain-language description
- [ ] **STAT-03**: Status command detects if `.env` is missing or incomplete and tells the user to run setup

### Allowlist Management

- [ ] **ALIST-01**: User can run `npm run allowlist add <email>` to add a sender without opening .env
- [ ] **ALIST-02**: User can run `npm run allowlist remove <email>` to remove a sender without opening .env
- [ ] **ALIST-03**: User can run `npm run allowlist list` to display current allowed senders and domains
- [ ] **ALIST-04**: Allowlist commands validate email/domain format before writing to .env
- [ ] **ALIST-05**: Allowlist commands remind the user to run `npm run push` after changes

## v2 Requirements

### Advanced Wizard

- **WIZ-01**: Wizard supports `--update` flag to update specific values without re-entering all fields
- **WIZ-02**: Wizard generates keywords in additional languages on request (beyond initial selection)
- **WIZ-03**: Wizard supports interactive keyword editing (add/remove individual keywords)

### Discovery Integration

- **DISC-01**: `npm run review-log` parses a pasted Apps Script execution log and extracts FORWARDED/REJECTED entries in a readable table
- **DISC-02**: Discovery output parser suggests senders to add to allowlist from FORWARDED entries

### Multi-Environment

- **ENV-01**: Support named environment profiles (e.g. `.env.production`, `.env.staging`)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web UI / browser-based config | Requires external hosting — violates no-external-services constraint |
| Direct Apps Script API calls from Node.js | Adds complex OAuth flow; existing clasp + editor workflow is simpler |
| Automated trigger management from CLI | Apps Script trigger API requires service account — too much setup overhead for the benefit |
| Real-time log streaming in terminal | Apps Script logs are accessible only via Google Cloud Logging or editor — not worth the OAuth complexity |

## Traceability

*Updated by roadmapper — 2026-04-10*

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase v1.0-01 | Pending |
| SETUP-02 | Phase v1.0-01 | Pending |
| SETUP-03 | Phase v1.0-01 | Pending |
| SETUP-04 | Phase v1.0-01 | Pending |
| SETUP-05 | Phase v1.0-01 | Pending |
| SETUP-06 | Phase v1.0-01 | Pending |
| SETUP-07 | Phase v1.0-01 | Pending |
| SETUP-08 | Phase v1.0-01 | Pending |
| CFG-01 | Phase v1.0-02 | Pending |
| CFG-02 | Phase v1.0-02 | Pending |
| CFG-03 | Phase v1.0-02 | Pending |
| CFG-04 | Phase v1.0-02 | Pending |
| CFG-05 | Phase v1.0-02 | Pending |
| ROLL-01 | Phase v1.0-03 | Pending |
| ROLL-02 | Phase v1.0-03 | Pending |
| ROLL-03 | Phase v1.0-03 | Pending |
| ROLL-04 | Phase v1.0-03 | Pending |
| ROLL-05 | Phase v1.0-03 | Pending |
| STAT-01 | Phase v1.0-03 | Pending |
| STAT-02 | Phase v1.0-03 | Pending |
| STAT-03 | Phase v1.0-03 | Pending |
| ALIST-01 | Phase v1.0-04 | Pending |
| ALIST-02 | Phase v1.0-04 | Pending |
| ALIST-03 | Phase v1.0-04 | Pending |
| ALIST-04 | Phase v1.0-04 | Pending |
| ALIST-05 | Phase v1.0-04 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Baseline requirements: 9 total (cross-cutting, applied across all phases)
- Mapped to phases: 26/26
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 — traceability expanded to per-requirement rows by roadmapper*
