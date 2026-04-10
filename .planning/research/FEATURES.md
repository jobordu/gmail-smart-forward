# Feature Research: Gmail Smart Forward CLI Setup Wizard

**Domain:** Interactive CLI setup wizard and configuration management for developer tools  
**Researched:** 2026-04-10  
**Confidence:** HIGH  

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete and they abandon the tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Interactive guided setup wizard** | Users expect first-run to walk them through setup rather than requiring manual .env editing. This is table stakes for modern dev tools (npm init, create-react-app, Salesforce CLI all do this). | MEDIUM | Replaces manual .env file editing. Must handle interruption (resume) and provide clear defaults. |
| **Input validation with clear error messages** | Real-time validation (per-field, not just end-of-form) is expected. Errors must be specific ("Invalid email format: must be user@domain.com") not vague ("Invalid input"). Users expect guidance on how to fix, not just "no". | LOW | Standard Inquirer.js pattern. Separate validation logic from prompts for reusability. |
| **Sensible defaults** | Users should be able to press Enter through entire wizard and get a working configuration. No required-in-real-world fields with blank defaults. | LOW | Dramatically reduces perceived friction. Gmail-focused defaults (e.g., "Gmail" as target service). |
| **Configuration persistence** | Setup answers must be saved locally so users don't repeat setup on next CLI run. Tool must be idempotent (running setup twice = same result). | LOW | Store in project's .env or config.json (already exists per PROJECT.md). Idempotency = critical for confidence. |
| **Dry-run / preview before commit** | Users expect to preview what will happen (e.g., "Here are the senders you've allowlisted, keywords matched, attachment types filtered") before actually running backfill or enabling live mode. This is standard in Unix tools (`git commit --dry-run`, `rsync --dry-run`). | MEDIUM | Separate preview logic from execution. Use structured output (not raw logs). |
| **Progress feedback** | Long-running operations (backfill, discovery) should show progress: what's happening now, how far along, estimated time remaining. Spinners + status messages expected. | MEDIUM | Use cli-progress or similar. Clear transition from "downloading" (gerund) to "downloaded" (past tense) when complete. Use checkmarks and green for success. |
| **Status visibility** | Users want a quick way to see current state without re-running setup: "Is live mode on? How many forwarded emails? Any errors in last run?" | LOW-MEDIUM | `status` command showing: mode (preview/backfill/live), trigger state, label counts, last execution timestamp. |
| **Config validation before push** | Before deploying to Apps Script (`clasp push`), validate that all required fields are present and sensible (e.g., at least one allowed sender, at least one keyword). Catch errors before the deploy fails. | LOW | Run validation after wizard or before push. Provide clear list of what's missing/broken. |
| **Context-aware help** | Users expect error messages to include actionable next steps, not just "Error". If validation fails, hint at the solution ("Add at least one keyword; see `smart-forward config add-keyword`"). | LOW | Consistency in error message format. Build library of common errors + solutions. |

### Differentiators (Competitive Advantage)

Features that set this tool apart. Not required, but valuable and aligned with the "no external services" constraint.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **One-command rollout progression** | Users run `smart-forward rollout` once, tool guides them through preview → backfill → live in sequence, asking for confirmation at each step. Eliminates manual function runs and confusion about order. Differentiates from tools requiring manual multi-step processes. | MEDIUM | Depends on: dry-run, config validation, progress feedback. Orchestrates multiple phases. Strong UX win. |
| **In-app config management** | Users can add/remove allowlisted senders, keywords, etc. without touching .env or Apps Script editor. `smart-forward allowlist add user@example.com` persists to config. Massive UX improvement over today. | MEDIUM | Updates config.json locally, then syncs to Apps Script Properties on next push/run. Bridges CLI and Apps Script worlds. |
| **Guided keyword discovery** | During setup, optionally scan recent emails to suggest keywords the user is likely interested in (e.g., "Invoice" found in 47 emails from suppliers). Users can thumbs-up/thumbs-down to build keyword list. Reduces cold-start friction. | HIGH | Requires reading Gmail API (already exists per PROJECT.md). ML not needed—just frequency analysis + user confirmation. Differentiator because it reduces time-to-value. |
| **Setup checkpoints and resumability** | If wizard is interrupted, next run resumes from where it stopped. Users don't lose progress. Partial configs are valid (flag what's incomplete, allow using defaults). | MEDIUM | State machine: track which steps completed. Clear "resume" prompt on re-run. |
| **Config export/import** | Users can export their config (obfuscated secrets) to share with teammates or back up. Import from file or GitHub gist. Nice for team onboarding or documentation. | LOW-MEDIUM | Export as .json or YAML. Obfuscate secrets in export. Useful but not critical. |
| **Structured output modes** | Beyond human-readable progress: support `--json`, `--csv`, `--quiet` output for automation and scripts. Differentiates from tools that only support human output. | LOW | Standard table stakes for CLI tools (AWS CLI, GitHub CLI all do this). Enables integration. |
| **Rich terminal UI with context** | Use colors, icons, tables, and formatting to make setup feel polished and modern (vs. plain text). Show a progress summary after each step (e.g., ✓ Allowlist: 3 senders, ✓ Keywords: 7 terms). Delightful, not critical. | LOW | Use chalk/colors for styling. Simple tables for data display. Icons (✓, ✗, ⚠) for status. Polish, not core functionality. |

### Anti-Features (Deliberately Not Building)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | What to Do Instead |
|---------|---------------|-----------------|-------------------|
| **Web UI / browser-based setup** | "Modern", more discoverable for non-technical users. | Violates PROJECT.md constraint: "no external hosting". Adds complexity (server, auth, deployment). Goes against the tool's philosophy: keep it free and serverless. Users who need web UX likely need multi-user/multi-account management (out of scope anyway). | Keep CLI-only. Simplicity is the feature. Document setup flow in onboarding prompt. |
| **Real-time live configuration updates** | "Change keywords without stopping live mode". Sounds convenient. | Apps Script time-driven triggers run every 15 min. Changing config mid-run creates consistency issues (first execution sees old config, second sees new). Adds state management complexity. Users can wait 15 min or manually trigger a check. | Current 15-min cycle is fine. If urgent: document manual trigger (`smart-forward check now`). Don't try to be real-time. |
| **Multi-account support** | "Forward emails across multiple Gmail accounts". | Out of scope per PROJECT.md ("personal use only"). Adds OAuth complexity, team management, conflict resolution. Beyond the tool's purpose. | Single-account only. If user has multiple accounts, they run the tool multiple times (separate projects). |
| **AI-based keyword learning** | "Automatically learn keywords from forwarded emails". | Adds complexity without user control (anti-pattern for filter tools). Users deliberately want deterministic control ("I set what forwards, not the algorithm"). | Stick with keyword discovery (user-guided). Keep learning human-driven. |
| **Rollback / undo config changes** | "Oh no, I messed up. Go back to the previous config." | Minimal value: config changes are low-risk. Adds version history, branching logic. Users can manually edit config file if needed. Not worth complexity. | Keep config flat and simple. If user messes up: they manually fix or restart setup. |
| **Interactive config edit mode** | "Edit config with a TUI menu after setup". | Forces interactive flow when users want batch operations. Conflict with automation (scripts can't interact). Harder to implement and test. | Stick with discrete commands: `add-keyword`, `remove-sender`, etc. Scriptable by nature. |
| **Automatic dependency detection** | "Check if clasp is installed, prompt to install if not". | Scope creep: now you're a package manager. Users already have Node.js + npm. Just require clasp in package.json and document `npm install`. | Document prerequisites clearly. Let package manager handle it. |

---

## Feature Dependencies

```
[Sensible Defaults]
    └──required by──> [Input Validation]
                          └──required by──> [Config Persistence]
                                                └──required by──> [Status Visibility]

[Config Validation Before Push]
    └──required by──> [Dry-Run / Preview]
                          └──required by──> [One-Command Rollout Progression]
                                                └──requires──> [Progress Feedback]

[In-App Config Management]
    └──enhances──> [Configuration Persistence]

[Guided Keyword Discovery]
    └──enhances──> [Sensible Defaults]
    └──reduces friction for──> [One-Command Rollout Progression]

[Setup Checkpoints & Resumability]
    └──enhances──> [Interactive Guided Setup Wizard]

[Structured Output Modes]
    └──complements (not requires)──> [All features]
```

### Dependency Notes

- **Interactive Guided Setup Wizard requires Input Validation & Sensible Defaults:** A wizard without validation is a data-garbage generator. Defaults lower perceived friction.
- **Config Validation Before Push requires Config Persistence:** You can't validate what you haven't saved yet.
- **One-Command Rollout Progression requires Dry-Run + Progress Feedback + Config Validation:** This feature orchestrates all three; none are optional for rollout to work.
- **In-App Config Management enhances (not requires) Setup Wizard:** Wizard can function without it (users use .env). But together they make the tool dramatically better.
- **Guided Keyword Discovery enhances Setup:** Optional, but dramatically lowers cold-start friction.
- **Setup Checkpoints & Resumability enhances Setup Wizard:** Optional, but users will interrupt wizard (network hiccups, distractions). Resumability is a courtesy.

---

## MVP Definition

### Launch With (v1): Table Stakes Only

Minimum viable product for the configuration experience to feel complete and non-exploratory.

- [x] **Interactive guided setup wizard** — Users expect this; manual .env is the pain point being solved
- [x] **Input validation with clear error messages** — Prevents bad configs from being saved and causing cryptic failures later
- [x] **Sensible defaults** — Users should pass through in 2 minutes if they accept defaults
- [x] **Configuration persistence** — Must save answers so users don't repeat setup
- [x] **Dry-run / preview before commit** — Critical trust-builder: "Will this actually work?" before running backfill
- [x] **Progress feedback** — Long operations need spinners/status; users hate silent hangs
- [x] **Config validation before push** — Catch errors before clasp deploy (faster feedback loop)

### Add After Validation (v1.1–v1.2)

Features to add once core experience is working and users are comfortable with setup.

- [ ] **One-command rollout progression** — Once setup works, orchestrate the entire flow (preview → backfill → live). Requires all table stakes to be solid first.
- [ ] **Status visibility** — Quick `smart-forward status` to see current state. Non-critical but valuable for troubleshooting. Low effort.
- [ ] **In-app config management** — Add/remove senders/keywords without .env. Depends on solid persistence model first.

### Future Consideration (v2+)

Features to defer until product-market fit is established and user feedback clarifies priorities.

- [ ] **Guided keyword discovery** — Scan emails to suggest keywords. Nice UX but adds Gmail API interaction complexity. Defer until core wizard is rock-solid.
- [ ] **Setup checkpoints & resumability** — Wizard interruption handling. Nice-to-have, but full wizard only takes ~2 min anyway. Defer if time is tight.
- [ ] **Config export/import** — Share config across environments. Useful for teams, but out-of-scope for personal use. Defer.
- [ ] **Structured output modes** — JSON/CSV output. Table stakes for automation-heavy tools; less critical for setup wizard. Defer unless users ask.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| Interactive guided setup wizard | HIGH | MEDIUM | P1 | v1 |
| Input validation | HIGH | LOW | P1 | v1 |
| Sensible defaults | HIGH | LOW | P1 | v1 |
| Config persistence | HIGH | LOW | P1 | v1 |
| Dry-run / preview | HIGH | MEDIUM | P1 | v1 |
| Progress feedback | HIGH | MEDIUM | P1 | v1 |
| Config validation before push | HIGH | LOW | P1 | v1 |
| One-command rollout progression | MEDIUM | MEDIUM | P2 | v1.1 |
| Status visibility | MEDIUM | LOW | P2 | v1.1 |
| In-app config management | MEDIUM | MEDIUM | P2 | v1.1 |
| Guided keyword discovery | MEDIUM | HIGH | P3 | v2 |
| Setup checkpoints & resumability | LOW | MEDIUM | P3 | v2 |
| Config export/import | LOW | LOW | P3 | v2 |
| Structured output modes | LOW | LOW | P3 | v2 |

**Priority key:**
- **P1 (Must have for v1):** Table stakes. Without these, setup experience is not better than today.
- **P2 (Should add by v1.2):** High-value additions that scale confidence and usability once core works.
- **P3 (Nice to have, v2+):** Differentiators. Pursue after core is validated and stable.

---

## Patterns & Recommendations

### CLI Wizard Pattern (Table Stakes)

**What:** Multi-step interactive prompts using Inquirer.js (or similar). Confirm, text input, checkboxes, list selection.

**When:** First run, or when user runs `smart-forward setup`.

**Example workflow:**
1. Welcome message + brief explanation
2. Gmail target email (with validation)
3. Allowed senders (multi-step: add one, ask if more, repeat)
4. Keywords (multi-step: add one, ask if more, repeat)
5. Attachment types (checkbox defaults to PDF)
6. Excluded keywords (optional, multi-step)
7. Summary of what was configured
8. Offer to run dry-run immediately or save config

**Best practices (from research):**
- Use Inquirer.js or `@inquirer/prompts` (standard library, used by ESLint, Webpack, Yarn, Cypress, etc.)
- Always provide defaults. Users should be able to press Enter through entire wizard and get a working result.
- Validate each field in real-time (not just at end). Use validator functions (built into Inquirer).
- Clear error messages: "Please enter a valid email address, like user@domain.com" (not "Invalid format").
- Use gerund form for ongoing status ("Adding keywords..."), switch to past tense when complete ("Added 5 keywords").
- When prompting for lists (senders, keywords), support both "add more" loops and batch entry.

### Input Validation Pattern

**Standard library:** Inquirer.js has built-in `validate` and `filter` functions.

**Patterns:**
- Email validation: regex or email-validator library
- Domain whitelist: check against known Gmail providers
- Keyword length: reasonable min/max (e.g., 2-50 chars)
- Attachment types: whitelist (PDF, XLS, XLSX, DOC, DOCX, etc.)

**Error message structure:**
```
❌ [Field]: [What's wrong]. [How to fix it].
Example: "Allowed sender email: 'supplier' is not a valid email. Enter a full email address like supplier@company.com"
```

### Dry-Run / Preview Pattern (Table Stakes)

**What:** Show what will happen without actually executing it.

**Patterns (from research):**
- Standard flag: `--dry-run` or `-n`
- Preview mode for AWS, Pulumi, semantic-release, Git
- Preview should output a structured list of changes, not raw logs

**For Gmail Smart Forward:**
- `smart-forward preview` (default to most recent config)
- Output:
  ```
  DRY RUN PREVIEW (would process 347 emails)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Allowed Senders:    3 (supplier@company.com, invoice@vendor.com, noreply@bills.com)
  Keywords Matched:   7 (invoice, receipt, payment, contract, quote, statement, purchase order)
  Attachment Filter:  PDF only
  Excluded Keywords:  2 (spam, test)
  
  Would Forward:      127 emails (from past 6 months)
  Would Skip:         220 (no match)
  
  Proceed with backfill? (y/N)
  ```

### Progress Feedback Pattern (Table Stakes)

**Standard libraries:** `cli-progress`, `cli-spinner`, `ora`

**Patterns (from research):**
- Use spinners for indeterminate work ("Scanning emails...")
- Use progress bars for determinate work ("Downloaded 347/500 emails")
- Clear spinners/bars once complete
- Transition from gerund ("Scanning") to past tense ("Scanned 347 emails")
- Use colors: green for success, yellow for warning, red for error
- Use icons: ✓ for done, ✗ for failed, ⚠ for warning

**Example:**
```
✓ Loaded configuration
⏳ Scanning Gmail (347/500 emails)...
```

Then after completion:
```
✓ Loaded configuration
✓ Scanned 347 emails (220 matched criteria)
✓ Ready to forward
```

### Config Validation Pattern (Table Stakes)

**When:** Before pushing to Apps Script, or after setup wizard completes.

**Validation checklist:**
- At least 1 allowed sender? ✓
- At least 1 keyword? ✓
- Gmail target email is valid? ✓
- Attachment types list not empty? ✓

**Output:**
```
CONFIG VALIDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Allowed Senders:    3 configured
✓ Keywords:           7 configured
✓ Attachment Types:   PDF only
⚠ Excluded Keywords:  Not set (optional, will accept all)
✓ Target Email:       user@gmail.com

Ready to push to Apps Script? (y/N)
```

If validation fails:
```
CONFIG VALIDATION FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✗ Allowed Senders:    Not set (required)
  → Add senders: smart-forward config add-sender

✗ Keywords:           Not set (required)
  → Add keywords: smart-forward config add-keyword

✓ Target Email:       user@gmail.com

Fix the issues above, then run: smart-forward push
```

### Status Visibility Pattern

**Command:** `smart-forward status`

**Output:**
```
STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mode:                 LIVE (forwarding every 15 min)
Config:               Valid (last updated 2026-04-10)
Gmail Labels:
  ✓ Candidate:        347 emails
  ✓ Forwarded:        127 emails
  ✓ Rejected:         220 emails
  ✓ Discovered:       15 new senders
Last Check:           2 minutes ago
Next Check:           13 minutes (2026-04-10 14:37 UTC)
```

---

## Ecosystem Context: What Users Expect from Modern CLI Tools

**Research finding:** Modern CLI tools (AWS CLI, GitHub CLI, Clerk, ESLint, Webpack, Yarn) share these expectations:

1. **Interactive setup over manual config** — Modern users don't want to edit JSON by hand if the tool can ask
2. **Validation before execution** — Fail fast, with actionable error messages
3. **Progress feedback for long ops** — Spinners/progress bars for anything > 1 second
4. **Dry-run capability** — Always let users preview before destructive operations
5. **Status commands** — Quick way to see current state without re-running setup
6. **Structured output options** — `--json`, `--quiet`, `--format` for automation
7. **Context-aware help** — Errors should hint at next steps, not just report failure
8. **Resumability on interruption** — If setup breaks, don't force restart from scratch
9. **Config persistence** — Save answers locally so setup is idempotent
10. **Sensible defaults** — Users should get a working result with zero customization

**For Gmail Smart Forward:** The first 7 are table stakes for v1. The last 3 are v1.1+ (resumability, better defaults via discovery).

---

## Implementation Considerations

### Technology Stack (Assumed from PROJECT.md)

- **Node.js CLI:** Project already uses Node.js scripts + clasp
- **Prompt library:** Inquirer.js or `@inquirer/prompts` (standard, widely used)
- **Progress:** `cli-progress` or `ora` for spinners/bars
- **Styling:** `chalk` or `colorette` for colors/formatting
- **Validation:** Built into Inquirer + custom validators
- **Config storage:** `.env` or `config.json` (already exists per PROJECT.md)

### Risk / Complexity Notes

| Feature | Risk | Mitigation |
|---------|------|-----------|
| Interactive prompts in CI/non-TTY | Prompts fail if stdin not available | Detect TTY; provide non-interactive mode flag (`--config-file`) |
| Breaking existing workflow | Users with .env already set don't need wizard | Skip wizard if config already valid; offer `smart-forward setup --reset` to restart |
| Keyword discovery scanning Gmail | High API latency, rate limits | Make optional in wizard; cache results; document Gmail API setup |
| Config sync to Apps Script | Timing: when does config push to Apps Script? | Push on `clasp deploy`, or separate `smart-forward sync` command? (Design decision needed) |

---

## Sources

- [Command Line Interface Guidelines — clig.dev](https://clig.dev/)
- [Best Practices Building a CLI Tool for Your Service — Zapier Engineering Blog](https://zapier.com/engineering/how-to-cli/)
- [CLI UX best practices: 3 patterns for improving progress displays — Evil Martians](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays/)
- [Inquirer.js — npm](https://www.npmjs.com/package/inquirer)
- [Building Interactive CLIs with Node.js and Inquirer — Grizzly Peak Software](https://www.grizzlypeaksoftware.com/library/building-interactive-clis-with-nodejs-and-inquirer-zda12oy1)
- [Error Message UX, Handling & Feedback — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-error-feedback)
- [Designing Better Error Messages UX — Smashing Magazine](https://www.smashingmagazine.com/2022/08/error-messages-ux-design/)
- [Beyond .env Files: The New Best Practices for Managing Secrets in Development — InstaTunnel/Medium](https://medium.com/@instatunnel/beyond-env-files-the-new-best-practices-for-managing-secrets-in-development-b4b05e0a3055)
- [CLI Tools That Support Previews, Dry Runs or Non-Destructive Actions — Nick Janetakis](https://nickjanetakis.com/blog/cli-tools-that-support-previews-dry-runs-or-non-destructive-actions)
- [Git Workflow Guide with Examples for Pros — Toptal](https://www.toptal.com/git/git-workflows-for-pros-a-good-git-guide)
- [Onboarding UX: Best Practices for First-Time User Flow & Activation — Gap System Studio](https://gapsystudio.com/blog/onboarding-ux-design/)

---

*Feature research for: Gmail Smart Forward CLI configuration experience*  
*Researched: 2026-04-10*  
*Confidence: HIGH (verified against modern CLI tool standards, user research sources, and ecosystem patterns)*
