# AGENTS.md

Guidance for coding agents working on this repository.

## Apps Script Editor URL

When providing the Apps Script editor URL, always append `?authuser=0`:

```
https://script.google.com/d/YOUR_SCRIPT_ID/edit?authuser=0
```

If the user is logged into multiple Google accounts and `authuser=0` opens the wrong one, try `authuser=1`, `authuser=2`, etc. until the correct account loads.

## Project context

- Serverless Gmail forwarder on Google Apps Script
- Source files in `src/` use GAS global scope (`var` + `function` declarations)
- Tests in `test/` run in Node.js via Jest with a GAS mock transform
- The test transform is auto-generated from `/* exported */` directives — run `npm run generate-transform` after adding new exports
- Config lives in `.env` and is pushed to Apps Script via `npm run push` → `clasp push`
- Always run `npm test` and `npm run lint` before committing
