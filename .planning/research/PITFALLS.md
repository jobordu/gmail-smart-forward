# Pitfalls Research: CLI Tooling + Google Apps Script Configuration

**Domain:** Interactive CLI wizard for Google Apps Script configuration management  
**Researched:** 2026-04-10  
**Confidence:** MEDIUM-HIGH

---

## Critical Pitfalls

### Pitfall 1: Breaking Existing .env Workflow

**What goes wrong:**  
Users have manually maintained `.env` files that work with the existing `npm run push` → `clasp push` workflow. Adding a CLI wizard that creates `.env` automatically, reformats it, or requires a different structure breaks existing user setup scripts, automation, and muscle memory. Users who spent time carefully crafting their `.env` find it's now invalid or deprecated.

**Why it happens:**  
New tooling often assumes users will adopt the new path immediately. The existing `.env` → `scripts/build-env.js` → `src/_env.js` pattern is already battle-tested and production-ready. CLI tooling designers overlook that migrating users requires backward compatibility, not replacement.

**How to avoid:**
- **Strict backward compatibility:** The new CLI wizard must read and preserve existing `.env` files. If changes are needed, they must be migrations (not rewrites).
- **Dual-path support:** Support both `npm run push` and `npm run config` indefinitely. Users choosing non-interactive should never be forced to the wizard.
- **Non-destructive updates:** When the wizard modifies `.env`, write to a temp file, validate it, show a diff, and ask for explicit confirmation before replacing.
- **Version pinning:** Keep `scripts/build-env.js` untouched. New CLI simply calls it under the hood.

**Warning signs:**
- Users report `.env` no longer works after upgrade
- Existing `.env` files silently corrupted or reformatted
- CI/CD pipelines fail after CLI tooling added
- Support requests about "my old setup broke"

**Phase to address:** Phase 1 (Interactive CLI wizard) — must include compatibility layer before any code changes to .env handling.

---

### Pitfall 2: Incomplete State Representation (Wizard Makes Bad Assumptions)

**What goes wrong:**  
The CLI wizard prompts for `FORWARD_TO_EMAIL`, `ALLOWED_SENDERS`, attachment types, but the Apps Script runtime has more configuration than the wizard exposes. Users answer 5 questions, deploy, then discover critical flags missing (e.g., `MAX_EMAILS_PER_RUN`, `DRY_RUN`, label customization). The wizard-created config is incomplete, and users must edit `.env` manually anyway.

**Why it happens:**  
Wizard designers try to "simplify" by hiding advanced options. But this tool is power-user focused (no hosting, keyword matching instead of ML, manual allowlist curation). Simplicity that hides necessary options just creates confusion.

**How to avoid:**
- **Progressive disclosure, not hiding:** Show essential options first (forward-to, allowlist method), then gate advanced options behind "Advanced Settings?" prompt.
- **Config schema validation:** Before wizard completes, validate that `src/_env.js` or Script Properties would pass a full schema check. Flag missing required fields.
- **Audit checklist at end:** Before wizard exits, print a checklist: "You've configured X/Y required settings. Missing: [list]." Force explicit acknowledgment.
- **Document every field:** Keep `.env.example` in sync. Wizard help text should link to `docs/config-reference.md` for each field.

**Warning signs:**
- Users complete wizard but `npm run push` fails with "missing FORWARD_TO_EMAIL"
- Dry runs silently skip emails because `DRY_RUN` wasn't set by wizard
- Users discover mid-backfill that label names don't match their preference

**Phase to address:** Phase 1 (Wizard design) — schema and validation before first prompt.

---

### Pitfall 3: Wizard and Script Properties Get Out of Sync

**What goes wrong:**  
User runs the CLI wizard, which updates `.env` and calls `npm run push` to deploy to Apps Script. But the Script Properties inside Apps Script (bootstrap via `bootstrapProperties()`) still hold stale values from a previous deploy. The wizard creates one config, but the running script sees different values. Forwarding behavior doesn't match user expectations.

**Why it happens:**  
Users often skip the "run `bootstrapProperties()` in the editor" step because it's not obvious it's mandatory after each push. The wizard automates deployment but doesn't automate the Apps Script side. Two systems, two update steps — users forget one.

**How to avoid:**
- **Automate Script Properties refresh:** After `clasp push`, automatically call `clasp run bootstrapProperties` if possible. If clasp doesn't support this, document it as a required manual step with a giant warning banner.
- **State validation before critical actions:** Before running `dryRunBackfill` or `backfillApprovedSuppliers`, log Script Properties to the user and ask "Does this look right?" with a diff from the `.env` file.
- **Check on startup:** When the script runs (time trigger or manual), log which config it loaded from Script Properties. Users should be able to see "Using config version X from timestamp Y."
- **Config versioning:** Add a hash or timestamp of `.env` to the deployed `_env.js`. Script logs should show both expected and actual config hashes.

**Warning signs:**
- Users report "I set DRY_RUN=false but the backfill still ran dry"
- Different behavior between dry-run logs and actual forwarding
- "It worked yesterday, now emails aren't forwarding" — often a config staleness issue

**Phase to address:** Phase 1 (Wizard) and Phase 2 (Guided dry-run review) — validation before critical actions.

---

### Pitfall 4: clasp v3 Breaking Changes Not Anticipated

**What goes wrong:**  
The existing project uses `clasp@3.3.0`. The new CLI tooling assumes certain clasp commands work (e.g., `clasp run`, `clasp deploy`). But clasp v3 has renamed or removed commands, changed authentication flow, or altered the Apps Script API interaction. The wizard calls a clasp command that fails silently or with cryptic errors. Users see "Deploy failed" with no indication why.

**Why it happens:**  
clasp v3 introduced breaking changes. Not all clasp commands from v2 are directly available. For example, some management commands were restructured. CLI tooling that hasn't been tested against the exact clasp version will break when users have a different minor version.

**How to avoid:**
- **Pin clasp version strictly:** Use exact version in `package.json` (`"@google/clasp": "3.3.0"`) not `^3.3.0`. Document the specific tested version.
- **Test against actual clasp v3 behavior:** Don't assume `clasp run` works. Test locally. If it doesn't, use an alternative (e.g., check for function existence in script directly).
- **Wrap clasp calls with error handling:** Any shell call to `clasp push`, `clasp deploy`, etc., should capture stderr and provide actionable feedback. If clasp fails, log the full error and suggest next steps.
- **Pre-flight checks:** Before the wizard runs, verify `clasp --version` matches expected. Verify Apps Script API is enabled by attempting a lightweight clasp operation.

**Warning signs:**
- "Unknown command: clasp deploy" or "clasp run failed" with no clear reason
- Users on different Node.js versions (v18 vs v20) see different clasp behavior
- .clasp.json misconfiguration not caught until push

**Phase to address:** Phase 0/1 (Setup and environment validation) — check clasp version and Apps Script API before wizard proceeds.

---

### Pitfall 5: Cross-Platform Compatibility (Windows Path/Shell Issues)

**What goes wrong:**  
The CLI wizard is developed on macOS, uses shell paths, and calls clasp via npm scripts. A Windows user runs the wizard, and it breaks because:
- File paths use `/` instead of `\`
- Wizard calls a `.sh` script that doesn't exist on Windows
- Environment variable syntax differs (`$HOME` vs `%USERPROFILE%` vs `$env:USERPROFILE`)
- Terminal rendering (progress bars, colored output) corrupts on Windows PowerShell

**Why it happens:**  
Node.js CLI tools often assume Unix-like environments. Developers test on macOS/Linux but don't run on Windows. The Gmail Smart Forward tool currently works on all platforms because Google Apps Script abstracts the OS, but the Node.js build tooling doesn't.

**How to avoid:**
- **Use Node.js path module, not string concatenation:** For all file operations, use `path.join()` and `path.resolve()`. Never hardcode `/` or `\\`.
- **Use `cross-spawn` or `execa` for shell calls:** Don't call scripts directly. Use a library that handles Windows/Unix spawn differences.
- **Avoid shell-specific syntax in npm scripts:** If the wizard needs to run a build step, wrap it in a Node.js script, not a `.sh` file.
- **Test terminal rendering:** Use a library like `chalk` or `colorette` that handles ANSI color codes safely on all platforms. Test on actual Windows PowerShell, not just WSL.
- **Provide Node.js >= 20 requirement clearly:** clasp requires it. Document in README and package.json `"engines"`.

**Warning signs:**
- Windows users report "file not found" errors for paths that work on macOS
- Wizard prompts render garbled or cut off on Windows
- `npm run` scripts fail on Windows with "command not found"

**Phase to address:** Phase 1 (Wizard implementation) and Phase 2 (Guided dry-run review) — test on Windows, macOS, Linux before release.

---

### Pitfall 6: Over-Engineering the Wizard (Scope Creep)

**What goes wrong:**  
The wizard starts simple: ask for email, allowlist, file types. But designers keep adding features: "Let's add language detection," "Let's suggest keywords," "Let's auto-discover all suppliers first," "Let's build a full config editor." The wizard becomes 20 prompts long. Users get lost, make mistakes, or abandon setup. The tool that was supposed to simplify setup now feels more complex than manual `.env` editing.

**Why it happens:**  
Each new feature seems like a small addition. But each one adds branching logic, conditional prompts, and error cases. The wizard becomes a mini-application rather than a focused onboarding flow. Designers optimize for "perfect config" rather than "quick start."

**How to avoid:**
- **Lock the scope at design time:** Define MVP as: (1) email, (2) allowlist method (manual or discovery), (3) file types, (4) confirm DRY_RUN. Everything else is Phase N+1.
- **Two-path design:** Offer "Quick Setup" (5 prompts, sensible defaults) and "Advanced Setup" (all options). New users take quick path. Power users take advanced.
- **Time-box prompts:** If a wizard question takes more than 2-3 minutes to answer, it's too complex. Move it to docs or to "Edit config after setup."
- **Exit early with fallback:** If the wizard feels overwhelming, offer "Skip wizard, edit .env.example manually" as an always-available option.
- **Measure wizard abandonment:** Log how many users start the wizard vs. complete it. If drop-off is >50%, simplify.

**Warning signs:**
- Wizard has >10 prompts
- Conditional branching makes wizard flow hard to understand
- Users bypass wizard and edit `.env` manually anyway
- "Is there a way to skip the wizard?" in support requests

**Phase to address:** Phase 1 (Wizard design spec) — keep it focused. Document anti-features: what NOT to build.

---

### Pitfall 7: Apps Script Script Properties Size and Quota Limits

**What goes wrong:**  
The wizard allows users to add long allowlists (e.g., 500+ sender emails) or custom keywords in many languages. The resulting `.env` is large. When `scripts/build-env.js` generates `src/_env.js`, it's fine. But when `bootstrapProperties()` tries to store this in Script Properties, it silently fails or truncates because Google Apps Script Script Properties have a **size limit of ~500 KB total per project**. Users get partial or corrupted config without knowing why.

**Why it happens:**  
Developers assume the config can grow indefinitely. Google Apps Script quotas aren't obvious until you hit them. Users add keywords and senders over time, and suddenly forwarding stops working.

**How to avoid:**
- **Validate config size before deploy:** In `scripts/build-env.js`, calculate the size of the `_ENV` object. If it exceeds 400 KB (leaving margin), warn the user and suggest: "Your config is large. Consider: (1) Exclude less important keywords, (2) Use domain allowlist instead of individual senders."
- **Document the limits:** In `.env.example` and `docs/config-reference.md`, state clearly: "Script Properties have a 500 KB limit. Keep allowlists and keywords reasonable."
- **Implement config compression:** If needed, compress `ALLOWED_SENDERS` into a pipe-delimited or newline-delimited format instead of JSON. Keep it minimal.
- **Warn on large input:** During the allowlist discovery phase, if >100 suppliers are discovered, warn: "This is a lot. You can trim the list or use domain allowlisting instead."

**Warning signs:**
- User adds 200+ senders, then forwarding mysteriously stops
- `bootstrapProperties()` runs but subsequent script execution fails silently
- Config works locally (in `.env`) but not after push to Apps Script

**Phase to address:** Phase 4 (Discover suppliers) and Phase 1 (Validation) — implement size checks and clear feedback.

---

### Pitfall 8: Dry-Run → Backfill → Live State Transition Confusion

**What goes wrong:**  
The tool has three safety states:
1. **Dry-run:** Log what would forward, don't actually forward
2. **Backfill:** Forward historical emails that match  
3. **Live:** Forward new emails every 15 minutes

Users get confused about which state they're in. Someone runs the wizard, goes through Phases 2-3 in a rush, accidentally sets `ENABLE_LIVE_FORWARDING=true` without running backfill first. Now live mode is on, but no historical context. Or someone runs backfill, forgets to set `ENABLE_LIVE_FORWARDING=true`, and wonders why new emails aren't forwarding.

**Why it happens:**  
The state machine is implicit, not explicit. Users see boolean flags in `.env` but don't think about the ordinal sequence. The wizard doesn't visually represent the progression or warn about invalid state transitions.

**How to avoid:**
- **Explicit state display:** Add a command `npm run status` that clearly prints: "Current state: DRY_RUN=true, ENABLE_LIVE_FORWARDING=false → STATE: PREVIEW (nothing forwarded, logs only)".
- **Block invalid transitions:** The wizard should enforce: "You're in PREVIEW. Do you want to proceed to BACKFILL? [yes/no]". Don't let users skip steps.
- **Force transition confirmation:** When transitioning from Backfill → Live, require explicit confirmation and a checklist: "Make sure: (1) backfill worked, (2) target inbox received emails, (3) allowlist is correct." Don't auto-proceed.
- **Guided rollout as a single flow:** Don't make users manually edit `.env` and run multiple commands. The wizard should offer: "Run complete rollout (Dry-run → Review → Backfill → Live)?" and guide the whole thing.

**Warning signs:**
- User runs backfill but never sets `ENABLE_LIVE_FORWARDING=true`, wonders why new emails don't forward
- User sets `ENABLE_LIVE_FORWARDING=true` without backfill, realizes historical emails missing
- `DRY_RUN=false` but user forgets the script is now actively forwarding

**Phase to address:** Phase 3 (Rollout progression) — implement guided, linear progression with explicit state representation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Wizard stores config in local `.config/gmail-smart-forward.json` instead of `.env` | Separates UI state from Apps Script config, cleaner wizard UX | Two sources of truth, hard to debug, existing `.env` workflows break, no backward compat | Never — stick with `.env` as single source of truth |
| Skip validation of `ALLOWED_SENDERS` format (e.g., valid email regex) | Faster wizard, fewer prompts | Invalid config deployed, confusing runtime errors, users blame the tool | Only in MVP if explicitly documented as "validate manually after" |
| Assume all users want to run `clasp run` for script execution instead of manual trigger | Simpler UX, single button | Breaks for Workspace accounts with restricted API access, unclear error messages, doesn't work offline | Only if thoroughly tested across account types and documented as requirement |
| Store wizard responses in env vars during session instead of `.env` file until final confirmation | Avoid intermediate `.env` writes, safer | Confusing state if wizard crashes, can't resume, contradicts .env as source of truth | Only if wizard is fully atomic — if it crashes mid-way, cleanup is automatic |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **clasp push** | Assume the command is always available and succeeds. Don't check `clasp --version` or Apps Script API status before pushing. | Before wizard completes, run `clasp pull` as a preflight check to verify API is enabled and authentication is valid. Catch errors and suggest "Enable Apps Script API in Google Cloud Console." |
| **Script Properties via bootstrapProperties()** | Don't validate that Script Properties actually received the config. Assume the `.env` → `_env.js` → `bootstrapProperties()` chain always works. | After `bootstrapProperties()` runs, have a companion function `verifyConfig()` that logs actual Script Properties. Compare with expected `_ENV` object and alert if mismatch. |
| **Time-driven trigger** | Assume `setupTrigger()` always succeeds. Don't verify the trigger actually exists in Apps Script after calling it. | After `setupTrigger()` succeeds, poll the script's logger to confirm the trigger is firing (test with a 1-min trigger first). Alert if trigger never fires. |
| **Gmail label creation** | Assume labels can be created with any name. Don't check if label already exists or if the name has special characters. | Use `GmailApp.getUserLabels()` to check for existing labels before creating. Sanitize label names (no slashes in custom names, etc.). Warn user if label already exists and owned by another tool. |
| **.env file parsing** | Use simple string split or regex to parse `.env`. Miss edge cases: quoted values, escaped characters, inline comments. | Use a robust parser like `dotenv` (already in the project). Don't reinvent `.env` parsing. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Discovery phase too aggressive** | Wizard hangs or times out while discovering suppliers from Gmail history. Apps Script execution limit hit (6 minutes). | In the discovery phase, limit the email query: set `DISCOVERY_DAYS=30` by default, not 365. Show progress and allow incremental discovery instead of all-at-once. | When user has 10+ years of Gmail history and wizard tries to scan it all in one execution |
| **Large allowlist processing** | Classifier.js has to search through 500+ sender emails on every email processed. Script runs slow, takes >6min, timeout. | In the classifier, use a Set or object map instead of iterating an array. Precompute domain allowlist once. Use Gmail search filters to pre-filter before processing. | When allowlist grows to 200+ entries and 200 emails are processed per execution |
| **Dry-run output bloat** | Wizard generates huge dry-run log (1000+ log lines). User can't read it, overwhelmed. | Cap dry-run output: show top 10 candidates, 10 rejected, summary stats. Offer "Show full log?" as optional export. | When user runs discovery + dry-run against large mailbox |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Storing secrets in .env and committing it** | Plaintext API keys or emails exposed in git history. Third-party sees allowlists and forwarding targets. | `.env` is already in `.gitignore`. Enforce with gitleaks (already in the project). Warn users in README: "Never commit .env. Use .env.example with placeholders only." Document in SECURITY.md. |
| **Wizard logs Script Properties with secrets** | Script execution logs might be accessible via `clasp logs` or Google Cloud Console. If logs show full allowlist or forwarding target, it's exposed. | Don't log the full `_ENV` object. Log sanitized version: "Loaded config with X senders, Y keywords, forwarding to [redacted]." Warn users: execution logs may be visible. |
| **Over-sharing Script Properties access** | If user shares the Apps Script project with a teammate, that person can read all Script Properties (allowlist, forwarding target). | Document in SECURITY.md: "Each user should have their own Apps Script project. Don't share the script; instead, clone the repository and set up a separate project." |
| **Backfill without re-verifying allowlist** | User configures allowlist, runs backfill, adds new senders to allowlist, forgets to re-run backfill. Old emails don't get forwarded because they were already classified. | Backfill should be idempotent: either re-classify all candidate emails when allowlist changes, or force user to re-confirm and re-backfill after updating allowlist. |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **Error messages don't suggest next step** | `clasp push failed` with no context. User doesn't know if it's a network error, auth error, or API disabled. | Catch specific errors and provide actionable guidance: "Apps Script API not enabled. Enable it at console.cloud.google.com/apis/library/script.googleapis.com then retry." |
| **Wizard success but silent config failure** | Wizard says "Config saved!" but when the script runs, it fails silently. No error message. | After wizard completes, run a lightweight test: call `bootstrapProperties()` and `verifyConfig()` immediately. Report results before wizard exits. |
| **Long wizard with no save/resume** | User halfway through wizard, gets interrupted. Has to restart from the beginning. Loses all answers. | Save wizard state to a temp file. If wizard is re-run before completion, offer "Resume where you left off?" instead of starting over. |
| **No visibility into long-running operations** | Backfill runs and user has no idea if it's working or stuck. Appears frozen for 3 minutes. | Show progress: "Processing email 1/200... " with a spinner. Update every 5-10 seconds so user knows it's not frozen. |
| **Wizard jumps between concepts** | Prompts go: "Enter email → Choose file types → Configure keywords → Set language → Select allowlist method → Confirm DRY_RUN." User loses context. | Group prompts logically. "Email & Target" (email, file types), then "Security & Safety" (allowlist, DRY_RUN), then "Advanced" (keywords, language). Show section headers. |

---

## "Looks Done But Isn't" Checklist

- [ ] **Wizard completion:** Wizard says "Done!" but `.env` file not actually written to disk. Verify: File exists and contains all expected keys.
- [ ] **clasp push:** CLI says "Pushed successfully" but Apps Script API wasn't enabled. Verify: `clasp pull` works. Script ID matches `.clasp.json`.
- [ ] **Script Properties bootstrap:** Script runs but Properties weren't actually stored. Verify: `verifyConfig()` function retrieves and logs Properties. User reviews log output.
- [ ] **Dry-run logs completeness:** Logs show "10 forwarded, 5 rejected" but some emails were silently skipped due to parsing errors. Verify: Log includes "Processed: X total, Forwarded: Y, Rejected: Z, Errors: W."
- [ ] **Cross-platform:** CLI works on macOS but path errors on Windows. Verify: Test wizard on macOS, Linux (WSL or VM), and Windows PowerShell before release.
- [ ] **Backward compat:** Wizard reads existing `.env` but corrupts it. Verify: Run wizard against real `.env` file from earlier version. Diff before/after. Ensure no data loss.
- [ ] **Config size validation:** Config works locally but fails after push due to size limit. Verify: Pre-validate config size before `npm run push`. Warn if >400KB.
- [ ] **State transition guards:** User accidentally skips backfill and enables live mode. Verify: Wizard enforces linear progression. Can't transition from PREVIEW → LIVE without explicit BACKFILL step.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **User broke .env by editing it wrong** | LOW | Restore from git or .env.example. Re-run `npm run build-env` to regenerate `src/_env.js`. Re-push. |
| **Script Properties stale after wizard update** | LOW | Run `bootstrapProperties()` again in Apps Script editor. Verify with `verifyConfig()` logs. |
| **Accidental live mode enabled without backfill** | MEDIUM | Set `ENABLE_LIVE_FORWARDING=false`, re-push, run `backfillApprovedSuppliers`, then re-enable live. |
| **clasp auth token expired or Apps Script API disabled** | MEDIUM | Re-run `clasp login`. Re-enable Apps Script API in Google Cloud Console. Retry `clasp push`. |
| **Config size exceeded quota (Script Properties full)** | MEDIUM | Trim allowlist (remove low-confidence senders), remove non-essential keywords, re-generate `src/_env.js`, re-push, re-bootstrap. |
| **Cross-platform script path issue (Windows)** | MEDIUM-HIGH | Update wizard code to use Node.js `path` module instead of hardcoded paths. Test on Windows. Release patch. |
| **Entire wizard corrupted user's setup** | HIGH | Have a documented rollback procedure: revert `.env` from git, re-push old deploy, verify in Apps Script. Document what went wrong and how to fix the wizard. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Breaking existing .env workflow | Phase 1 (Wizard design) | Test wizard against real .env files from earlier versions. No data loss. |
| Incomplete state representation | Phase 1 (Wizard design) | Schema validation passes before wizard exits. All required config keys present. |
| Wizard and Script Properties out of sync | Phase 1 (Wizard) + Phase 3 (Rollout guidance) | `verifyConfig()` function runs and matches `_ENV` object. Logs show config hashes. |
| clasp v3 breaking changes | Phase 0/1 (Setup validation) | Pre-flight checks confirm clasp version, Apps Script API enabled, test `clasp pull`. |
| Cross-platform compatibility | Phase 1 (Wizard implementation) + Phase 2 (Guided review) | Test on macOS, Linux, Windows PowerShell. No path errors. Colored output renders correctly. |
| Over-engineering the wizard | Phase 1 (Scope lock in design) | Wizard has ≤10 prompts. Drop-off rate <25%. Users report setup takes <10 min. |
| Script Properties quota limits | Phase 1 (Validation) + Phase 4 (Discovery) | Config size validated. User warned if >300KB. Discovery capped at reasonable limit. |
| Dry-run → Backfill → Live state confusion | Phase 1 (Wizard) + Phase 3 (Rollout guidance) | `npm run status` shows current state clearly. Wizard enforces linear progression. Explicit transition confirmations. |

---

## Sources

- [Use the command-line interface with clasp | Google Apps Script](https://developers.google.com/apps-script/guides/clasp)
- [GitHub - google/clasp: Command Line Apps Script Projects](https://github.com/google/clasp)
- [Google Apps Script Quotas | Google for Developers](https://developers.google.com/apps-script/guides/services/quotas)
- [CLI Guidelines - Best Practices for Command Line Tools](https://clig.dev/)
- [Managing gcloud CLI Configurations | Google Cloud Documentation](https://docs.cloud.google.com/sdk/docs/configurations)
- [Running Cross-Platform Scripts in Node.js | Medium](https://imsaravananm.medium.com/running-cross-platform-scripts-in-nodejs-2af9f06babf7)
- [GitHub - bcoe/awesome-cross-platform-nodejs](https://github.com/bcoe/awesome-cross-platform-nodejs)
- [Writing Cross-Platform Node.js | George Ornbo](https://shapeshed.com/writing-cross-platform-node/)
- [The Configuration Trap: Why gcloud config is Your Best Friend (and Worst Enemy) | Medium](https://medium.com/@munish07/the-configuration-trap-why-gcloud-config-is-your-best-friend-and-worst-enemy-d27d941f7f7e)
- [My Experience Fixing clasp Login Errors on Google Workspace | DEV Community](https://dev.to/yo-shi/my-experience-fixing-clasp-login-errors-on-google-workspace-3nh)
- [Feature Creep in Software Development – Avoid Common Pitfalls | QAT](https://qat.com/feature-creep-in-software-development/)
- [Scope Creep: What It Is And How To Manage It | Built In](https://builtin.com/software-engineering-perspectives/scope-creep)

---

*Pitfalls research for: CLI tooling + Google Apps Script configuration management*  
*Researched: 2026-04-10*  
*Confidence: MEDIUM-HIGH — Based on official documentation (clasp, Apps Script quotas), community patterns (cross-platform Node.js), and domain-specific patterns (configuration management, wizard UX)*
