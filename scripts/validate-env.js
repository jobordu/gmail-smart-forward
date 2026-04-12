#!/usr/bin/env node
// scripts/validate-env.js
// Validates .env configuration before pushing to Apps Script.
// Run: npm run validate

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const errors = [];
const warnings = [];

if (!process.env.FORWARD_TO_EMAIL) {
  errors.push('FORWARD_TO_EMAIL is required but not set.');
} else if (!/@/.test(process.env.FORWARD_TO_EMAIL)) {
  errors.push('FORWARD_TO_EMAIL does not look like a valid email address.');
}

const senders = (process.env.ALLOWED_SENDERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const domains = (process.env.ALLOWED_DOMAINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const excSenders = (process.env.EXCLUDED_SENDERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const excDomains = (process.env.EXCLUDED_DOMAINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

if (senders.length === 0 && domains.length === 0) {
  warnings.push('No ALLOWED_SENDERS or ALLOWED_DOMAINS set. Backfill/live will forward nothing.');
}

excSenders.forEach(s => {
  if (senders.includes(s)) {
    errors.push('"' + s + '" is in both ALLOWED_SENDERS and EXCLUDED_SENDERS.');
  }
});

excDomains.forEach(d => {
  if (domains.includes(d)) {
    errors.push('"' + d + '" is in both ALLOWED_DOMAINS and EXCLUDED_DOMAINS.');
  }
});

const extensions = (process.env.ATTACHMENT_EXTENSIONS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
if (extensions.length === 0) {
  errors.push('ATTACHMENT_EXTENSIONS is empty or not set. No attachments will match.');
}
extensions.forEach(ext => {
  if (ext.startsWith('.')) {
    warnings.push('ATTACHMENT_EXTENSIONS contains "' + ext + '" with a dot prefix. Use plain extensions (e.g. "pdf" not ".pdf").');
  }
});

const dryRun = process.env.DRY_RUN !== 'false';
const live = process.env.ENABLE_LIVE_FORWARDING === 'true';
if (live && senders.length === 0 && domains.length === 0) {
  errors.push('ENABLE_LIVE_FORWARDING is true but no allowlist is configured.');
}

if (process.env.ENABLE_LLM_CLASSIFICATION === 'true') {
  if (!process.env.LLM_API_KEY) {
    errors.push('ENABLE_LLM_CLASSIFICATION is true but LLM_API_KEY is not set.');
  }
  const threshold = parseFloat(process.env.LLM_CONFIDENCE_THRESHOLD || '0.7');
  if (isNaN(threshold) || threshold < 0 || threshold > 1) {
    errors.push('LLM_CONFIDENCE_THRESHOLD must be between 0 and 1, got ' + process.env.LLM_CONFIDENCE_THRESHOLD);
  }
}

const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath) && !process.env.FORWARD_TO_EMAIL) {
  errors.push('.env file not found. Copy .env.example to .env and fill in your values.');
}

console.log('Validating .env config...\n');

if (errors.length > 0) {
  console.log('ERRORS:');
  errors.forEach(e => console.log('  x ' + e));
  console.log();
}

if (warnings.length > 0) {
  console.log('WARNINGS:');
  warnings.forEach(w => console.log('  ! ' + w));
  console.log();
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('Config looks good.');
  console.log('  State: ' + (live ? 'Live' : dryRun ? 'Preview (DRY_RUN)' : 'Backfill'));
  console.log('  Forward to: ' + process.env.FORWARD_TO_EMAIL);
  console.log('  Allowed senders: ' + (senders.join(', ') || '(none)'));
  console.log('  Allowed domains: ' + (domains.join(', ') || '(none)'));
  console.log('  Extensions: ' + extensions.join(', '));
  process.exit(0);
} else if (errors.length > 0) {
  console.log('Fix the errors above before running npm run push.');
  process.exit(1);
} else {
  console.log('Config has warnings but no errors. Safe to push.');
  process.exit(0);
}
