# Gmail Smart Forward — Claude Code Onboarding Prompt

Paste this prompt into a Claude Code session opened at the root of this repository.

---

## Prompt

I want you to onboard me through the complete Gmail Smart Forward setup. Guide me step by step, phase by phase, following the Rollout Guide in README.md exactly. Do not skip any phase or run ahead.

At each step:
- Tell me exactly what to do and what to expect
- Wait for me to confirm the step completed successfully before moving to the next one
- If I paste execution logs, read them carefully and tell me if something looks wrong
- If a step fails, help me diagnose and fix it before continuing

Before we start, ask me:
1. **Origin email** — the Gmail address to set up (the one that receives emails)
2. **Target email** — where matched emails should be forwarded to (e.g. accounting inbox, Revolut, bookkeeper)
3. **Use case** — what kind of emails should be forwarded? (e.g. supplier invoices, shipping notifications, legal documents, payslips…)
4. **Languages** — what language(s) do these emails arrive in? (e.g. English, Portuguese, French, Spanish…)

Use the origin and target emails throughout the session when referencing config.

Based on the use case and languages, generate a tailored set of `SUBJECT_KEYWORDS` and `ATTACHMENT_FILENAME_KEYWORDS` — covering synonyms, common subject line patterns, and attachment naming conventions in all specified languages. Write these into `.env` before the first `npm run push`. The defaults in `src/constants.js` are a bilingual PT/EN invoice example — override them for any other use case.

The full phase-by-phase instructions are in `docs/rollout-guide.md`. The config variables and maintenance tasks are in `docs/config-reference.md`. Use these as your source of truth throughout the session.

We progress through three safety states. Never skip ahead — each state requires explicit confirmation before moving to the next:

| State | DRY_RUN | ENABLE_LIVE_FORWARDING | What happens |
|---|---|---|---|
| 1 — Preview | `true` | `false` | Nothing is sent. Logs show what *would* be forwarded. |
| 2 — Backfill | `false` | `false` | Historical emails are forwarded. No live trigger yet. |
| 3 — Live | `false` | `true` | New emails are forwarded automatically every 15 min. |

Work through these phases in order, one at a time:

**Phase 0** — Clone, install Node dependencies, install clasp globally  
**Phase 1** — Enable Apps Script API, clasp login, create Apps Script project, find editor URL  
**Phase 2** — Create .env, set FORWARD_TO_EMAIL, run npm run push — confirm we are in State 1 (DRY_RUN=true, ENABLE_LIVE_FORWARDING=false)  
**Phase 3** — Run bootstrapProperties in the editor, verify config in execution log  
**Phase 4** — Run discoverSuppliers, ask me to paste the execution log, help me review and curate the allowlist, update .env, push, re-bootstrap  
**Phase 5** — Run dryRunBackfill, ask me to paste the execution log, review every FORWARDED entry together, iterate until the list is clean. Do not proceed until I explicitly approve the forwarded list.  
**Phase 6** — Transition to State 2: set DRY_RUN=false (keep ENABLE_LIVE_FORWARDING=false), push, re-bootstrap, confirm config shows the correct state, run backfillApprovedSuppliers, verify emails arrived at target inbox  
**Phase 7** — Transition to State 3: set ENABLE_LIVE_FORWARDING=true, push, re-bootstrap, run setupTrigger, verify trigger appears in the Apps Script Triggers panel  

At the end, confirm the rollout checklist from `docs/rollout-guide.md` is complete.

Start by asking me for the origin email and target email.
