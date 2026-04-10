# Research Summary: Gmail Smart Forward CLI Wizard & Config Management

**Domain:** Node.js CLI tooling for interactive Google Apps Script deployment and configuration
**Researched:** 2026-04-10
**Overall confidence:** HIGH

## Executive Summary

The 2025 Node.js ecosystem has matured significantly for building interactive CLI wizards. The recommended stack pairs **Inquirer.js 13.x** (actively maintained, recently rewritten for performance) with **Zod 4.x** (14x faster schema validation than v3) and **TypeScript** for type-safe configuration management. This combination is proven in production across thousands of CLI tools (ESLint, webpack, yarn, Cypress, Google Lighthouse).

The key constraint is App Script's ES5-only runtime—this research focuses exclusively on Node.js tooling, which handles the interactive wizard, config validation, and .env file generation. The resulting configuration is deployed to Apps Script via clasp, which remains the only viable deployment mechanism for Google Apps Script.

Critically, **dotenv-only validation is insufficient**—missing keys silently become undefined and cause runtime failures in Apps Script. The stack includes mandatory validation (Zod) at startup to fail fast with clear error messages before any files are written.

## Key Findings

**Stack:** Inquirer.js 13.4+ for interactive prompts, Zod 4.3+ for schema validation, chalk/ora for visual feedback, cli-table3 for output formatting.

**Why not oclif:** Full CLI framework with 28 dependencies is overkill for a wizard that's part of a larger tooling suite. Raw Inquirer + Node.js provides the right abstraction level.

**Why not Enquirer:** Unmaintained for 3 years; Inquirer.js is the clear modern choice with 41M weekly downloads and active development.

**Config validation pattern:** Zod catches all errors at startup (missing keys, type mismatches, invalid emails) before writing .env. Reduces debugging time in Apps Script exponentially.

**Format recommendation:** Keep JSON for .env format (ecosystem standard) rather than YAML/TOML. Node.js projects default to JSON; no tooling overhead.

## Implications for Roadmap

The recommended architecture naturally suggests a phased approach:

1. **Phase 1: Core Wizard Infrastructure**
   - Set up Inquirer.js with TypeScript
   - Build basic prompts for sender allowlist, keywords, target email
   - Implement Zod schema for configuration validation
   - Output validated config to console (no file writes yet)
   - **Addresses:** Interactive CLI wizard requirement from PROJECT.md
   - **Avoids:** Jumping to file I/O before validating user input

2. **Phase 2: Config Persistence & Deployment**
   - Implement .env file writing from validated config
   - Integrate with existing `npm run push` workflow (build-env.js)
   - Add visual feedback (ora spinners) during validation and deployment
   - Dry-run mode that shows what will be written before committing
   - **Addresses:** Config validation with clear error messages
   - **Avoids:** Silent failures from incomplete configuration

3. **Phase 3: Enhanced UX & Summary Output**
   - Add chalk-colored summary table (cli-table3) of configuration before write
   - Show label counts and mode status after deployment
   - Implement one-command rollout progression (preview → backfill → live)
   - **Addresses:** Guided dry-run review + status command from PROJECT.md
   - **Avoids:** Raw execution log parsing by users

4. **Phase 4: In-Script Allowlist Management (Future)**
   - Add commands to manage allowlist without editing .env manually
   - Sync allowlist from Script Properties back to Node.js config
   - Validate changes before syncing
   - **Addresses:** In-script management without touching .env

**Phase ordering rationale:**
- Validation must come before persistence (Phase 1 → 2)
- User feedback polish is lower priority than correctness (Phases 2 → 3)
- Advanced features (Phase 4) depend on solid foundation

**Research flags for phases:**
- **Phase 1:** Standard patterns, unlikely to need deeper research. TypeScript + Inquirer are proven. Risk: none.
- **Phase 2:** May need phase-specific research on clasp integration if build-env.js has gotchas. Risk: low.
- **Phase 3:** May want to research optimal table formatting for accessibility (wide terminals, wrap behavior). Risk: low.
- **Phase 4:** Script Properties API access from Node.js may need research if not documented. Risk: medium.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | Verified with official npm, GitHub releases, and 2025 community consensus. Inquirer.js versions checked as of April 10, 2026. Zod 4.3.6 confirmed in npm. All recommendations use actively maintained libraries. |
| **Alternatives** | HIGH | Enquirer explicitly flagged as unmaintained (3 years); Zod compared against Joi/convict with performance benchmarks from official releases; oclif evaluated as overkill for scope. All alternatives verified. |
| **Patterns** | HIGH | Inquirer + Zod pattern is production-standard in ESLint, webpack, Cypress. Pattern directly applicable to Apps Script deployment workflow. |
| **Constraints** | HIGH | Apps Script ES5 limitation confirmed in PROJECT.md. Node.js tooling avoids this entirely. No conflicts between stack choices and constraints. |
| **Integration** | MEDIUM | Integrating with existing build-env.js script and clasp push workflow requires phase-specific research in Phase 2. Stack itself proven, integration is implementation question. |

## Gaps to Address

1. **clasp v3 integration details:** How does clasp v3 handle Script Properties vs .env? Need to verify in Phase 2 if build-env.js pattern needs updates. (Current project uses clasp 3.3.0 successfully, so risk is low.)

2. **Google Apps Script credential handling:** Does the wizard need to guide users through Apps Script API enablement, or is that pre-requisite? May need documentation update in Phase 1.

3. **Dry-run backfill UX:** How to show preview results (email count, matched keywords, etc.) in Node.js without executing Apps Script? May need Phase 3 research on querying Gmail without Apps Script runtime.

4. **Multi-environment support:** Should wizard support production/staging/test .env files? Current scope assumes single .env. May be deferrable post-MVP.

5. **Config file location:** Should config live in `.env`, `config.json`, or `gmail-smart-forward.json`? Current plan is .env (familiar to users). Alternative formats (TOML/JSON) require Phase 2 evaluation if users request.

## Recommendations

- **Start immediately with Phase 1** using Inquirer.js 13.4+ and Zod 4.3+. Both are proven, stable, and solve the core problem.
- **Do NOT wait for further research** on these libraries. The ecosystem is clear and mature.
- **Prioritize validation over pretty output** (Phase 2 before Phase 3). Getting config right prevents hours of debugging in Apps Script.
- **Document the Apps Script API enablement step** early. Users will need it regardless of wizard quality.
- **Consider keyboard navigation in prompts.** Inquirer supports arrow keys; test with actual users before release.

---

*Research completed: 2026-04-10*
*Confidence: HIGH across all domains*
*Next: Use this summary to create Phase 1 plan for wizard infrastructure*
