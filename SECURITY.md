# Security Policy

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report vulnerabilities privately by emailing: **jonathan@digitalfrontier.so**

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact

You will receive a response within 72 hours. If the issue is confirmed, a fix will be prioritised and a patched release published as soon as possible. You will be credited in the release notes unless you prefer otherwise.

## Scope

This tool runs entirely in your own Google account via Google Apps Script. It has access to your Gmail (read, modify, send) via OAuth scopes you grant during setup. No data is sent to any third-party server — forwarding goes directly through the Gmail API to the target address you configure.

The main security surface areas are:

- **`.env` file** — contains your target email. Gitignored. Never commit it.
- **`src/_env.js`** — auto-generated from `.env`. Gitignored. Never commit it.
- **Script Properties** — stored in your Google account, not in this repo.
- **Allowlist** — controls which senders can trigger forwarding. Keep it tight.
