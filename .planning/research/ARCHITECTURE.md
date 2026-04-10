# Architecture Research: Interactive CLI for Gmail Smart Forward

**Domain:** Google Apps Script deployment + Node.js CLI tooling integration  
**Researched:** 2026-04-10  
**Confidence:** HIGH

---

## System Overview

The project needs to layer interactive CLI tooling on top of an existing Node.js/clasp/Google Apps Script stack. The architecture spans three connected domains:

1. **User Input Layer (CLI)** — Interactive prompts in Node.js, running locally
2. **Configuration Layer** — Config file (.env) as source of truth, with validation
3. **Deployment Layer** — Apps Script properties (via build-env.js → _env.js → Script Properties)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           User's Local Machine                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        CLI Input Layer                               │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │  │
│  │  │ Interactive      │  │ Config           │  │ Guided          │   │  │
│  │  │ Prompts          │  │ Validation       │  │ Workflows       │   │  │
│  │  │ (setup, edit,    │  │ (before .env     │  │ (dry-run →      │   │  │
│  │  │ review)          │  │ write)           │  │ backfill →      │   │  │
│  │  │                  │  │                  │  │ live)           │   │  │
│  │  └──────────────────┘  └──────────────────┘  └─────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                  ↓                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Configuration Layer                               │  │
│  │  ┌───────────────┐    ┌───────────────┐    ┌─────────────────────┐ │  │
│  │  │ .env (Local   │←→  │ .env Schema   │    │ .env Parser &       │ │  │
│  │  │ source of     │    │ Validation    │    │ Environment         │ │  │
│  │  │ truth)        │    │ Rules         │    │ Auto-completion     │ │  │
│  │  └───────────────┘    └───────────────┘    └─────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                  ↓                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Deployment Layer (npm scripts)                    │  │
│  │  ┌───────────────┐    ┌───────────────┐    ┌─────────────────────┐ │  │
│  │  │ build-env.js  │→   │ _env.js       │→   │ clasp push          │ │  │
│  │  │ (.env reader) │    │ (generated)   │    │ (to Apps Script)    │ │  │
│  │  └───────────────┘    └───────────────┘    └─────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                  ↓ npm run push
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Google's Infrastructure                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                    Apps Script Runtime                             │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐   │   │
│  │  │ _env.js          │→ │ Script Properties│→ │ Config.js     │   │   │
│  │  │ (pushed globals) │  │ (runtime store)  │  │ (accessor)    │   │   │
│  │  └──────────────────┘  └──────────────────┘  └───────────────┘   │   │
│  │                                                     ↓             │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │   │
│  │  │ setup.js         │  │ backfill.js      │  │ live.js      │   │   │
│  │  │ (bootstrap)      │  │ (historical)     │  │ (trigger)    │   │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────┘   │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---|---|
| **Interactive CLI** (commands/) | Prompt user for config values, walk through workflows, validate inputs before writing .env | Config Validator, .env file system |
| **Config Validator** (lib/config-validator.js) | Validate config schema, enforce constraints (required fields, type coercion, allowlists formatting) | Interactive CLI, .env file |
| **.env File** | Single source of truth for all user configuration | build-env.js, Interactive CLI |
| **build-env.js** (existing) | Read .env, apply transformations (auto-date computation), generate _env.js | .env, _env.js |
| **_env.js** (generated) | Global object pushed to Apps Script as part of src/ | Apps Script via clasp push |
| **npm scripts** (package.json) | Orchestrate build pipeline (build-env → validate → push) | build-env.js, config validator, clasp |
| **Apps Script Config.js** (existing) | Accessor for Script Properties at runtime | Apps Script modules (setup, backfill, live) |

---

## Recommended Project Structure

```
gmail-smart-forward/
├── src/                          # Google Apps Script (ES5, deployed via clasp)
│   ├── _env.js                   # AUTO-GENERATED by build-env.js
│   ├── config.js                 # EXISTING: Script Properties accessor
│   ├── setup.js                  # EXISTING: Bootstrap utilities
│   ├── backfill.js               # EXISTING: Historical forwarding
│   ├── live.js                   # EXISTING: Time-driven trigger
│   └── [other modules...]        # EXISTING: Core logic
│
├── scripts/                       # Node.js build & CLI scripts
│   ├── build-env.js              # EXISTING: .env → _env.js generator
│   └── hooks/                    # EXISTING: Git hooks
│
├── lib/                           # NEW: Reusable modules for CLI
│   ├── config/
│   │   ├── schema.js             # Config schema definition & validation
│   │   ├── validator.js          # Validate before .env write
│   │   └── loader.js             # Read & parse .env safely
│   │
│   ├── cli/
│   │   ├── prompts.js            # Reusable prompt templates
│   │   └── formatters.js         # Output formatting (tables, status)
│   │
│   └── workflows/
│       ├── setup-workflow.js     # Initial onboarding (interactive)
│       ├── edit-workflow.js      # Edit existing config
│       ├── review-workflow.js    # Review current state + dry-run
│       └── rollout-workflow.js   # Guided State 1→2→3 progression
│
├── bin/                           # NEW: CLI entry points
│   ├── cli.js                    # Main CLI dispatcher (bin field in package.json)
│   └── commands/
│       ├── setup.js              # Initialize new user (replaces onboard.md prompt)
│       ├── config.js             # View/edit .env without manual editing
│       ├── review.js             # Run dry-run, display formatted output
│       ├── rollout.js            # Guided state progression
│       └── status.js             # Show current mode, trigger state, label counts
│
├── .env                          # EXISTING: Source of truth (gitignored)
├── .env.example                  # EXISTING: Template
├── package.json                  # EXISTING: npm scripts (add CLI commands)
└── README.md                      # EXISTING: Update to reference new CLI

```

### Structure Rationale

- **src/** — Unchanged. Apps Script files only. Keep clasp's rootDir pointing here.
- **scripts/build-env.js** — Unchanged. Core Node.js infrastructure already working.
- **lib/config/** — Centralized config validation logic, reused by CLI and build pipeline.
- **lib/cli/** — Prompts, formatters, output templates. Easy to test and reuse across commands.
- **lib/workflows/** — Business logic for multi-step user journeys. Each workflow composes prompts + validation + config writes.
- **bin/commands/** — Individual CLI commands that delegate to workflows.
- **bin/cli.js** — Command dispatcher. Lightweight entry point.

This structure keeps the existing clasp workflow intact while adding CLI functionality in a separate namespace.

---

## Architectural Patterns

### Pattern 1: Configuration Schema Validation

**What:** Define config schema once (required fields, types, constraints), use it to validate user input before writing .env.

**When to use:** Every time user input touches config (setup, edit, import, discovery output → allowlist).

**Trade-offs:**
- Pro: Prevents invalid .env from being pushed to Apps Script
- Pro: Single source of truth for config rules
- Con: Adds validation layer before write (minor latency)

**Example:**
```javascript
// lib/config/schema.js
const CONFIG_SCHEMA = {
  FORWARD_TO_EMAIL: {
    type: 'email',
    required: true,
    error: 'Must be a valid email address'
  },
  ALLOWED_SENDERS: {
    type: 'comma-separated-emails',
    required: false,
    default: ''
  },
  DRY_RUN: {
    type: 'boolean',
    required: true,
    default: 'true',
    error: 'Must be "true" or "false"'
  }
};

function validateConfig(config) {
  const errors = [];
  for (const [key, rules] of Object.entries(CONFIG_SCHEMA)) {
    const value = config[key];
    if (rules.required && !value) {
      errors.push(`${key}: ${rules.error}`);
    } else if (value && !validate[rules.type](value)) {
      errors.push(`${key}: ${rules.error}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
```

### Pattern 2: Workflow Composition

**What:** Complex operations (setup, rollout progression) are workflows that compose prompts, validation, and side effects (file writes, running npm scripts).

**When to use:** Multi-step user journeys where order matters and you need to gather input, validate, apply changes, and show results.

**Trade-offs:**
- Pro: Each step is testable independently
- Pro: Easy to add rollback if a step fails
- Con: Workflows can be verbose with many steps

**Example:**
```javascript
// lib/workflows/setup-workflow.js
async function setupWorkflow() {
  // Step 1: Gather config
  const config = await promptForConfig();
  
  // Step 2: Validate
  const { valid, errors } = validateConfig(config);
  if (!valid) {
    console.error('Config invalid:', errors);
    return;
  }
  
  // Step 3: Write .env
  writeEnv(config);
  
  // Step 4: Run build-env.js
  await execSync('npm run build-env');
  
  // Step 5: Confirm and offer next steps
  console.log('✓ .env written and validated');
  console.log('Next: npm run push, then bootstrapProperties in Apps Script editor');
}
```

### Pattern 3: Stateful Prompts (Current State Awareness)

**What:** Prompts are aware of current .env state and Apps Script deployment state (via clasp). Pre-fill with existing values, disable actions that don't apply to current state.

**When to use:** Edit, review, and rollout commands where you need to adapt UI to user's progress.

**Trade-offs:**
- Pro: Reduces user confusion ("What state am I in?")
- Pro: Prevents invalid state transitions
- Con: Requires reading .env and querying Apps Script (small latency)

**Example:**
```javascript
// bin/commands/rollout.js
async function rolloutCommand() {
  const env = loadEnv();
  const state = getCurrentState(env); // State 1, 2, or 3
  
  if (state === 1) {
    // DRY_RUN=true, offer dry-run review
    const { proceed } = await prompt({
      message: 'You are in State 1 (Preview). Review dry-run output?',
      type: 'confirm'
    });
    if (proceed) {
      await reviewWorkflow();
    }
  } else if (state === 2) {
    // DRY_RUN=false, offer transition to State 3
    const { goLive } = await prompt({
      message: 'You are in State 2 (Backfill). Ready to enable live forwarding?',
      type: 'confirm'
    });
    // ...
  }
}
```

### Pattern 4: Graceful CLI/Apps Script Boundary

**What:** CLI commands never directly manipulate Script Properties. Instead, they write .env, user runs `npm run push`, then manually bootstraps in Apps Script editor (or CLI offers to open browser + explain).

**When to use:** Any time you need to bridge local config with remote runtime state.

**Trade-offs:**
- Pro: Respects the existing workflow (npm scripts → clasp → Apps Script)
- Pro: Clear separation of concerns
- Con: Requires user to complete manual step (bootstrap) to see changes take effect
- Con: Can be confusing if user forgets this step

**Why:** Apps Script auth is tied to browser session. CLI can't auth to Apps Script API without major complexity. Accepting manual bootstrap keeps this simple.

---

## Data Flow

### Config File → Apps Script Deployment Flow

```
.env (user edits locally)
  ↓ (user runs: npm run push)
build-env.js (reads .env)
  ↓
_env.js (generated globals object)
  ↓ (clasp pushes all src/ files)
Apps Script Project (src/_env.js deployed)
  ↓ (user runs: bootstrapProperties in editor)
Script Properties (runtime config store)
  ↓ (Config.js reads at runtime)
Apps Script Modules (setup, backfill, live)
```

### Interactive Workflow Example: Setup

```
User runs: node bin/cli.js setup
  ↓
promptForConfig() [interactive prompts]
  ├─ Origin email? (detect from clasp login)
  ├─ Target email?
  ├─ Use case? (supplier invoices, etc.)
  └─ Languages? (EN, FR, ES, etc.)
  ↓
validateConfig() [schema validation]
  ├─ Check required fields present
  ├─ Validate email formats
  └─ Generate SUBJECT_KEYWORDS from use case + languages
  ↓
writeEnv(config) [.env write]
  ↓
execSync('npm run build-env') [generate _env.js]
  ↓
printNextSteps()
  ├─ "Run: npm run push"
  ├─ "Then in Apps Script editor: setup → bootstrapProperties → Run"
  └─ "Then run: node bin/cli.js review (for dry-run preview)"
```

### Interactive Workflow Example: Rollout Progression

```
User runs: node bin/cli.js rollout
  ↓
getCurrentState() [read .env: DRY_RUN=true/false, ENABLE_LIVE_FORWARDING=true/false]
  ├─ State 1: DRY_RUN=true, ENABLE_LIVE_FORWARDING=false
  ├─ State 2: DRY_RUN=false, ENABLE_LIVE_FORWARDING=false
  └─ State 3: DRY_RUN=false, ENABLE_LIVE_FORWARDING=true
  ↓
If State 1:
  ├─ Show: "You are in State 1 (Preview mode)"
  ├─ Prompt: "Review dry-run output? (runs dryRunBackfill in Apps Script editor)"
  └─ Explain what to do next
  ↓
If State 2:
  ├─ Show: "You are in State 2 (Backfill mode)"
  ├─ Prompt: "Ready to enable live forwarding? (State 3)"
  ├─ Update .env: DRY_RUN=false, ENABLE_LIVE_FORWARDING=true
  ├─ Run: npm run push
  └─ Explain next steps
  ↓
If State 3:
  └─ Show: "You are in State 3 (Live mode)"
```

---

## Build Order & Dependency Chain

When building the CLI, respect this order to avoid breaking existing workflows:

### Phase 1: Foundations (No breaking changes)
1. **lib/config/schema.js** — Define config schema, validation rules
2. **lib/config/loader.js** — Load and parse .env safely
3. **lib/config/validator.js** — Validate config against schema
   - These three layers can be tested independently
   - No changes to package.json yet

### Phase 2: CLI Utilities (Minimal npm additions)
4. **lib/cli/prompts.js** — Reusable prompt templates using @inquirer/prompts
5. **lib/cli/formatters.js** — Output formatting (tables, status displays)
6. **lib/workflows/\*** — Workflows that compose prompts + validation
   - Add `@inquirer/prompts` and `chalk` to devDependencies only initially
   - No changes to src/ required

### Phase 3: CLI Commands (Standalone entry point)
7. **bin/cli.js** — Command dispatcher
8. **bin/commands/status.js** — First command (simplest, read-only)
9. **bin/commands/review.js** — Display dry-run results
10. **bin/commands/config.js** — View/edit .env interactively
11. **bin/commands/setup.js** — Initial setup workflow
12. **bin/commands/rollout.js** — State progression guide
    - Add `"bin": { "gsf": "bin/cli.js" }` to package.json
    - Add `npm run gsf` as alias to package.json scripts

### Phase 4: Integration (Update existing scripts)
13. **Update scripts/build-env.js** — Add validation step before _env.js write
    - Call configValidator.validate() before generating _env.js
    - Fail fast if .env is invalid
14. **Update package.json** — Add new npm scripts for CLI commands
    - `npm run gsf setup`, `npm run gsf review`, `npm run gsf rollout`
    - Or expose via bin entry point

### Phase 5: Documentation (No code changes)
15. Update README to reference CLI commands instead of manual steps
16. Update onboard.md to use CLI instead of Claude Code session

---

## Integration with Existing npm Scripts

The new CLI commands should integrate smoothly with the existing workflow:

```bash
# EXISTING (still works):
npm run build-env     # generates src/_env.js
npm run push          # builds env + runs clasp push
npm run pull          # clasp pull
npm run deploy        # clasp push + deploy version

# NEW (complementary):
npm run gsf setup     # Interactive first-time setup
npm run gsf review    # Preview what would forward (dry-run)
npm run gsf rollout   # Guided State 1→2→3 progression
npm run gsf status    # Show current mode + config summary

# Manual steps (still required):
npm run push          # After any .env edit
# Then in Apps Script editor:
#   setup.gs → bootstrapProperties → Run
#   (or future: npm run gsf bootstrap in browser)
```

The key principle: **CLI writes .env, npm scripts + clasp deploy to Apps Script, Apps Script bootstraps to Script Properties.**

---

## Component Communication

### CLI ↔ Configuration File
- **CLI reads .env** for current state (before prompts, to pre-fill)
- **CLI writes .env** after validation
- **No direct Script Properties access** from CLI (can't auth without browser)

### CLI ↔ Apps Script Editor
- **No direct communication.** User bridges the gap:
  - CLI instructs user to "Run bootstrapProperties in editor"
  - User sees execution logs in editor, confirms success
  - CLI prompts next steps

### npm Scripts ↔ Apps Script
- **build-env.js** reads .env, generates _env.js
- **clasp push** deploys all src/ files (including generated _env.js)
- **User runs bootstrapProperties** in editor to activate config

### Config Schema ↔ Validation
- **Schema** is a single source of truth for all config rules
- **Validator** checks against schema before .env write
- **build-env.js** optionally revalidates before _env.js write (early error detection)

---

## Critical Integration Points

### 1. .env as Single Source of Truth
- All config reads come from .env (CLI, build-env.js, App)
- Apps Script never reads .env directly (it reads Script Properties)
- Always validate .env before pushing

### 2. CLI Prompts Must Handle Existing Values
- If user runs `npm run gsf edit`, pre-fill prompts with current .env values
- If no .env exists, prompts must be required
- Show "Current value: X" before asking for new value

### 3. State Transitions Require Explicit Confirmation
- Never automatically transition from State 1→2 or 2→3
- Always show current state and require user confirmation
- Explain what each state means

### 4. build-env.js Must Run Before clasp push
- Ensure .env → _env.js happens in correct order
- Existing `npm run push` script already does this correctly
- CLI commands that modify .env should remind user to run `npm run push`

### 5. Error Handling Across Layers
- If .env is invalid, **build-env.js should fail** and explain which fields
- If validation fails in CLI, **don't write .env** — show errors and re-prompt
- If clasp push fails, **CLI should catch** and suggest fixes (enable Apps Script API, etc.)

---

## Scaling Considerations

For this personal-use tool, scaling is not a concern. However, the architecture should handle:

| Scale | What's Fine | What's Not |
|-------|---|---|
| 1 user (personal) | Current architecture works perfectly. Simple .env file. | Nothing yet. |
| 10 users (small group) | Config file per account (.env can be shared, but .clasp.json is personal). | Still fine — each user has their own .env + .clasp.json. |
| 100+ users (if open-sourced widely) | Would want Web UI for config management. Cloud storage for config history. | CLI becomes bottleneck for non-technical users. |

**For the current milestone:** Assume 1-2 users. Keep it simple. No distributed config, no remote state, no API.

---

## Anti-Patterns

### Anti-Pattern 1: CLI Writing to Script Properties Directly

**What people do:** Try to auth CLI to Apps Script API and update Script Properties directly.

**Why it's wrong:** 
- Requires complex OAuth setup
- CLI can't auth to Apps Script without browser session
- Violates separation of concerns (CLI shouldn't touch runtime state)

**Do this instead:** 
- CLI writes .env
- User runs `npm run push`
- User runs bootstrapProperties in Apps Script editor (or future: CLI opens browser)
- .env is the single source of truth

### Anti-Pattern 2: Multiple Config Files

**What people do:** Have .env AND a separate JSON config AND Script Properties out of sync.

**Why it's wrong:** 
- Confusion about which is authoritative
- Changes to one don't propagate to others
- Hard to debug config issues

**Do this instead:** 
- .env is the only local config file
- Script Properties is derived from .env
- If values diverge, resync via bootstrapProperties

### Anti-Pattern 3: CLI Trying to Read Script Properties

**What people do:** CLI queries Script Properties to check current state.

**Why it's wrong:** 
- Requires complex OAuth + Apps Script API calls
- Script Properties is ephemeral (can be cleared)
- .env is the canonical source anyway

**Do this instead:** 
- Read .env to understand current state (DRY_RUN, ENABLE_LIVE_FORWARDING flags)
- Trust .env as source of truth
- If user wants to inspect runtime state, they can view execution logs in Apps Script editor

### Anti-Pattern 4: Coupling CLI Commands to Apps Script Functions

**What people do:** CLI tries to call Apps Script functions (dryRunBackfill, etc.) directly.

**Why it's wrong:** 
- Can't invoke Apps Script functions without browser auth
- Script execution is time-limited and quota-restricted
- User can't monitor execution in editor

**Do this instead:** 
- CLI instructs user which Apps Script function to run
- User manually runs it in Apps Script editor
- CLI helps interpret the execution logs user pastes back

---

## Sources

- [Node.js CLI Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices) — Configuration, state, and architecture patterns
- [CLI Architecture in Node.js](https://medium.com/swlh/cli-architecture-in-nodejs-852e95773403) — Component design and mode-based structure
- [Building Interactive CLIs with Inquirer.js](https://www.grizzlypeaksoftware.com/library/building-interactive-clis-with-nodejs-and-inquirer-zda12oy1) — Prompt composition and UX patterns
- [How to Create a CLI Tool with Node.js](https://oneuptime.com/blog/post/2026-01-22-nodejs-create-cli-tool/view) — Modern CLI design patterns for 2026
- [Inquirer.js GitHub](https://github.com/SBoudrias/Inquirer.js) — Interactive prompt library (recommended for this project)
- [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts) — Modern Inquirer rewrite with smaller bundle size

---

*Architecture research completed: 2026-04-10*  
*Confidence: HIGH — Based on existing project patterns + validated Node.js CLI best practices + integration with current clasp/Apps Script workflow*
