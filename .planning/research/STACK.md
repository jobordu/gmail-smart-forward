# Stack Research: Interactive CLI Wizard & Config Management

**Domain:** Node.js CLI tooling for Google Apps Script deployment
**Researched:** 2026-04-10
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **TypeScript** | 5.3+ | Type-safe CLI development | Catches configuration errors at compile time; essential for a wizard that guides users through setup. Our existing project already uses TypeScript (types for Google Apps Script). |
| **Inquirer.js** | 13.4+ | Interactive prompts & wizard navigation | Actively maintained (updated 2 days ago as of research date), reduced bundle size after rewrite, 41M weekly downloads. Superior to Enquirer (unmaintained for 3 years) and prompts (less powerful). Supports conditional questions, validation, autocomplete. |
| **Zod** | 4.3+ | Schema validation for config | 14x-7x faster parsing than Zod 3; validates entire config object at startup with automatic type inference. Lightweight, zero-dependency validation that catches config errors before the script runs. |
| **Node.js** | 18+ or 20+ | Runtime | Already in use; maintains compatibility with clasp (3.3.0). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **dotenv** | 17.4+ | Load .env file for sensitive config | Already in project; pair with dotenv-safe or Zod validation to ensure all required vars are present. Required because Apps Script credential secrets must stay out of version control. |
| **chalk** | 5.3+ | Colored terminal output | Highlight success (green), warnings (yellow), errors (red), info (cyan) in wizard. ESM-only (chalk 5.x); use CommonJS workaround or stick with 4.x if needed. |
| **ora** | 8.0+ | Progress spinners & status | Show "Loading config..." or "Validating setup..." during long operations. Pairs well with chalk for visual polish. |
| **cli-table3** | 0.6+ | Pretty-print structured output | Display dry-run results, config summary, label counts in readable tables. Unicode-safe, maintains column alignment. |
| **fs/promises** | Built-in | Config file I/O (JSON/TOML) | Read/write .env files and optional structured config files. No external dependency needed. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **TypeScript Compiler** | Compile TS to JS | Already in workflow via clasp. Ensure strict mode enabled in tsconfig.json. |
| **ESLint + TypeScript parser** | Type-aware linting | Catch common CLI mistakes (unused vars, unreachable code). |
| **Jest** | Unit test CLI logic | Test wizard flows, config validation, file parsing in isolation before touching Apps Script. |

## Installation

```bash
# Core interactive CLI
npm install inquirer zod dotenv chalk ora cli-table3

# Dev dependencies
npm install -D typescript @types/node eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser jest ts-jest @types/jest
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Inquirer.js** | Prompts (npm) | If you need only simple text/confirm prompts and want minimal deps (Prompts is smaller). Use Prompts for dead-simple wizards. Avoid for complex conditional flows. |
| **Inquirer.js** | Enquirer | Only if maintaining legacy code; Enquirer unmaintained since 2022. For new projects, Inquirer is strict upgrade. |
| **Zod** | Joi or convict | If you need more complex transformation pipelines. Joi larger; convict weaker TypeScript support. Zod wins on speed, bundle size, type inference. |
| **chalk** | kleur or picocolors | If bundle size critical and only need basic colors (kleur 10x faster, smaller). chalk better DX. For CLI tool, chalk overhead negligible. |
| **cli-table3** | Ink (React-based) | If building fully interactive terminal UI. Ink overkill for this use case (just printing config summary). |
| **JSON config files** | YAML or TOML | JSON is safest for Node.js ecosystem. YAML adds complexity (indentation errors); TOML cleaner but non-standard in Node. Keep JSON for maximum portability. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **oclif** | Full-featured CLI framework (28 deps, plugin architecture); massive overkill for config wizard. Better for building standalone CLI tools. | Raw Inquirer + Node.js. Our wizard is a feature of the tooling, not a standalone product. |
| **Chalk 5.x (without ESM setup)** | ESM-only; breaks CommonJS-first projects without build step. | Chalk 4.x if project is CommonJS. Chalk 5.x if project is ESM. Verify tsconfig and build output. |
| **prompt** (flatiron) | Abandoned, last update 2014. No async/await support. | Use Inquirer.js (modern, active, async). |
| **Manual config file parsing** | Fragile; prone to edge cases (missing keys, type mismatches, nested objects). | Use Zod for declarative validation with clear error messages. |
| **envalid** | Older than Zod; focuses only on environment vars, not general config validation. | Use Zod which covers both env and structured config. Zod more actively developed. |
| **dotenv without validation** | Silent failures: missing keys become undefined; bugs surface at runtime in Apps Script. | Pair dotenv with Zod or dotenv-safe to catch config errors at startup. |

## Stack Patterns by Variant

**If building the wizard as a REPL (request-response loop in npm scripts):**
- Use Inquirer.js for stateful conversational prompts
- Validate and persist each answer immediately to .env
- Each prompt is a separate npm script invocation (less ideal but simpler)

**If building a single-session wizard (recommended for this project):**
- Use Inquirer.js for multi-step flows in one process
- Collect all answers, validate entire config with Zod, then write .env + optional config.json
- Better UX: user sees validation errors before any files are written
- Use chalk to show a summary of what will be written

**If adding in-script allowlist management later:**
- Read allowlist from Script Properties (Apps Script API) or persist separately in Node.js
- Validate additions/removals with Zod before syncing to .env
- Use ora to show sync status to user

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| inquirer@13.4+ | node@18+ | Requires Node 18+ for full feature support. Works with TypeScript 5.3+. |
| zod@4.3+ | node@16+ | Supports Node 16+, but recommend 18+ for consistency. No breaking changes from 3.x for basic usage. |
| chalk@5.3+ | ESM projects only | CommonJS projects must use chalk@4.x or add ESM/CommonJS interop layer. |
| chalk@4.x | node@10+ | Stable, CommonJS-compatible. Slight performance overhead vs chalk@5. |
| dotenv@17.4+ | node@14+ | Supports all modern Node versions. No major breaking changes from 16.x. |
| inquirer + zod | No conflicts | Both ESM/CommonJS compatible. Pair them without issues. |

## Configuration Pattern

This stack enables a clean pattern for config wizard + validation:

```typescript
// 1. Define schema
const ConfigSchema = z.object({
  senders: z.array(z.string().email()),
  keywords: z.array(z.string()),
  targetEmail: z.string().email(),
  // ... etc
});

// 2. Prompt user
const answers = await inquirer.prompt([
  {
    type: 'input',
    name: 'senders',
    message: 'Allowed senders (comma-separated):',
    validate: (input) => {
      try {
        ConfigSchema.pick({ senders: true }).parse({ senders: input.split(',') });
        return true;
      } catch (e) {
        return e.message;
      }
    }
  }
  // ... more prompts
]);

// 3. Validate entire config
const config = ConfigSchema.parse(answers);

// 4. Write to .env + show summary
writeEnvFile(config);
console.log(chalk.green('✓ Configuration saved!'));
showConfigSummary(config);
```

## Sources

- [Inquirer.js npm](https://www.npmjs.com/package/inquirer) — Active, 13.4.1 as of 2026-04-10
- [Zod GitHub Releases](https://github.com/colinhacks/zod/releases) — Zod 4.3.6 released Jan 2026, 14x faster than v3
- [Zod npm](https://www.npmjs.com/package/zod) — Current version 4.3.6, v4 released July 2025
- [dotenv npm](https://www.npmjs.com/package/dotenv) — 17.4.1, actively maintained
- [chalk npm](https://www.npmjs.com/package/chalk) — 5.3+, ESM-only as of v5
- [ora npm](https://www.npmjs.com/package/ora) — 8.0+, spinner library, actively maintained
- [cli-table3 npm](https://www.npmjs.com/package/cli-table3) — 0.6+, table formatting for CLI
- [Node.js LTS](https://nodejs.org/) — 18+ or 20+ recommended for 2025 projects
- [TypeScript Best Practices 2025](https://dev.to/mitu_mariam/typescript-best-practices-in-2025-57hb) — Strict mode essential for type safety
- [Inquirer vs Enquirer comparison](https://npmtrends.com/enquirer-vs-inquirer-vs-prompt-vs-prompts) — Inquirer 41M weekly vs Enquirer 24M; Inquirer actively maintained
- [Node.js Config Format Guide 2025](https://dev.to/jsontoall_tools/json-vs-yaml-vs-toml-which-configuration-format-should-you-use-in-2026-1hlb) — JSON best for Node.js ecosystem; YAML/TOML add complexity

---
*Stack research for: Gmail Smart Forward CLI Wizard & Config Management*
*Researched: 2026-04-10*
