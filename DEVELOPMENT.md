# Development Guide

This guide is for contributors who want to understand the codebase, run tests, and submit changes.

## Architecture

Gmail Smart Forward runs on [Google Apps Script](https://developers.google.com/apps-script) — a serverless JavaScript platform tied to your Google account. There is no server, no build step for production, and no npm runtime. All code in `src/` is pushed directly to Apps Script via `clasp`.

### Module structure (`src/`)

| File | Responsibility |
|---|---|
| `constants.js` | Static defaults — keyword lists, label names, numeric limits |
| `config.js` | Runtime config loader — reads from Apps Script **Script Properties** |
| `logging.js` | Structured JSON logger (`Log.info`, `Log.warn`, `Log.error`) |
| `labels.js` | Gmail label CRUD — create, lookup, check, add, remove |
| `gmail-search.js` | Gmail query builder — constructs search strings for discovery and backfill |
| `classifier.js` | Core classification — allowlist, denylist, keyword match, attachment check |
| `llm.js` | Optional LLM-based invoice verification (multimodal: email body + PDF) |
| `forwarding.js` | Email forwarding logic — forwards qualifying messages individually |
| `discovery.js` | Supplier discovery — scans Gmail history, ranks by PDF count and recency |
| `backfill.js` | Historical backfill — processes past threads in dry-run or real mode |
| `live.js` | Live mode — processes new emails via time-driven trigger |
| `setup.js` | Bootstrap, trigger management, label setup, config validation |
| `_env.js` | **Auto-generated** from `.env` by `npm run build-env`. Never edit directly. |

### Data flow

```
Gmail inbox
  │
  ├─ discoverSuppliers()     → scans history → ranked sender list
  │
  ├─ dryRunBackfill()        → classify + log (no forwarding)
  ├─ backfillApprovedSuppliers() → classify + forward historical
  │
  └─ processLiveEmails()     → classify + forward new (triggered every 15 min)
        │
        ├─ classifier.classify(thread, message)
        │     ├─ already-forwarded? → skip
        │     ├─ excluded sender?   → reject
        │     ├─ not allowlisted?   → reject
        │     ├─ no allowed attach? → reject
        │     ├─ LLM enabled?      → verify via vision model
        │     └─ null (forward)
        │
        └─ forwarding.forward(thread, message) → GmailApp.sendEmail / forward()
```

### Config flow

```
.env  →  npm run build-env  →  src/_env.js  →  clasp push  →  Apps Script
                                                         ↓
                                                   bootstrapProperties()
                                                         ↓
                                                   Script Properties (runtime config)
```

`config.js` reads exclusively from Script Properties at runtime. The `.env` → `_env.js` → Script Properties pipeline is a deployment convenience, not a runtime dependency.

## Testing

### Test stack

- **Jest** with a custom transform (`test/transform/gas-modules.js`) that rewrites `var Foo = ...` to `global.Foo = ...` so Apps Script's global-scope IIFEs work in Node.js
- **GAS mocks** (`test/setup/gas-mocks.js`) stub `PropertiesService`, `GmailApp`, `Logger`, `UrlFetchApp`, `Utilities`, `ScriptApp`, `DocumentApp`, `DriveApp`
- **Module loader** (`test/setup/load-modules.js`) loads `src/` files in dependency order

### Coverage

95% threshold on branches, functions, lines, and statements. Configured in `jest.config.js`.

### Running tests

```bash
npm test                    # unit tests + coverage
npm run test:watch          # watch mode
npm run test:e2e            # LLM integration test (requires API key)
```

### Writing tests

Follow the existing pattern in `test/`:

1. Call `resetTestState()` before each test (resets all mocks and default Script Properties)
2. Override specific props via `resetTestState({ FORWARD_TO_EMAIL: 'x@y.com' })`
3. Use `createMockMessage()`, `createMockThread()`, `createMockAttachment()` from `gas-mocks.js`
4. Access mock stores directly: `mockPropsStore`, `mockLabelsRegistry`, `mockLoggerLogs`, `mockGmailApp`, etc.

### E2E test

`test/e2e-llm.test.js` runs against a real LLM API. It requires `LLM_API_KEY` in your environment and is excluded from `npm test` by default.

## Code style

This project runs on Google Apps Script, which imposes constraints:
- Use `var` (not `let`/`const`) in `src/` — GAS runtime is V8 but the `var`-based IIFE pattern is the established convention here
- Modules use the revealing module pattern: `var Foo = (function () { ... return { public: fn }; })();`
- No `import`/`export`/`require` — all modules share a global scope loaded by Apps Script
- ES6 features (arrow functions, template literals, destructuring) are fine

### Linting

```bash
npm run lint           # run ESLint
npm run lint:fix       # auto-fix
```

## Dev workflow

```bash
# 1. Create a branch
git checkout -b feature/my-change

# 2. Edit code in src/
# 3. Build env + push to Apps Script
npm run push

# 4. Test in the Apps Script editor
# 5. Run unit tests locally
npm test

# 6. Commit and push
git add -A && git commit -m "feat: description"
git push origin feature/my-change
# 7. Open a PR
```

## Safety states

Never skip states. Each transition requires explicit confirmation:

| State | `DRY_RUN` | `ENABLE_LIVE_FORWARDING` | What happens |
|---|---|---|---|
| 1 — Preview | `true` | `false` | Nothing sent. Logs only. |
| 2 — Backfill | `false` | `false` | Historical emails forwarded. No live trigger. |
| 3 — Live | `false` | `true` | New emails forwarded every 15 min. |

## Useful commands

| Command | What it does |
|---|---|
| `npm run push` | Build `_env.js` + push to Apps Script |
| `npm run deploy` | Push + create a new deployment |
| `npm run logs` | Stream Apps Script execution logs |
| `npm run secrets` | Full gitleaks scan |
| `npm run secrets:staged` | Scan only staged files |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run install-hooks` | Install git pre-commit and pre-push hooks |

## Further reading

- [Rollout Guide](docs/rollout-guide.md) — step-by-step setup
- [Config Reference](docs/config-reference.md) — all `.env` variables and maintenance tasks
- [Apps Script Docs](https://developers.google.com/apps-script/reference)
