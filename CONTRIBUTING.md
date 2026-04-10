# Contributing

Contributions are welcome — bug reports, fixes, and well-scoped features.

## Before you start

For anything beyond a small bug fix, open an issue first to discuss the change. This avoids wasted effort if the direction doesn't fit the project.

## Setup

```bash
git clone https://github.com/jobordu/gmail-smart-forward
cd gmail-smart-forward
npm install
npm install -g @google/clasp
npm run install-hooks   # installs the gitleaks pre-commit hook
```

Follow the [Rollout Guide](docs/rollout-guide.md) to connect to your own Apps Script project for testing.

## Workflow

```bash
git checkout -b fix/your-change   # or feature/your-change
# make changes
npm run push                       # push to your Apps Script project
# test manually in the Apps Script editor
git commit -m "..."
git push origin fix/your-change
# open a PR against main
```

## Guidelines

- Keep changes focused. One concern per PR.
- Do not commit `.env`, `src/_env.js`, or `.clasp.json` — all are gitignored for good reason.
- Run `npm run secrets` before pushing to confirm no secrets are staged.
- All PRs run the `gitleaks` secret scan CI check. It must pass before merging.
- Write clear commit messages. Prefer the imperative mood ("Add X", "Fix Y", "Remove Z").

## What fits this project

- Bug fixes
- New supported file extensions or attachment types
- Improved discovery logic
- Better keyword coverage (especially non-English languages)
- Documentation improvements

## What doesn't fit

- Adding external service dependencies (this tool is intentionally self-contained)
- Storing credentials or tokens anywhere other than Script Properties
- Changes that require a paid Google Workspace account to use

## Reporting bugs

Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) issue template. Include your execution log output — it contains the structured JSON that makes diagnosis much faster.
