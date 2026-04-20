const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts/validate-env.js');

function run(env = {}) {
  try {
    const output = execSync('node ' + script, {
      cwd: root,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, output };
  } catch (e) {
    return { exitCode: e.status, output: e.stdout + e.stderr };
  }
}

describe('validate-env', () => {
  test('passes with minimal valid config', () => {
    const result = run({
      FORWARD_TO_EMAIL: 'test@example.com',
      ATTACHMENT_EXTENSIONS: 'pdf',
      DRY_RUN: 'true',
      ENABLE_LIVE_FORWARDING: 'false',
      ENABLE_LLM_CLASSIFICATION: 'false',
      ALLOWED_SENDERS: 'supplier@example.com',
    });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Config looks good');
  });

  test('fails when FORWARD_TO_EMAIL is missing', () => {
    const result = run({
      FORWARD_TO_EMAIL: '',
      ATTACHMENT_EXTENSIONS: 'pdf',
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('FORWARD_TO_EMAIL is required');
  });

  test('fails when FORWARD_TO_EMAIL has no @', () => {
    const result = run({
      FORWARD_TO_EMAIL: 'not-an-email',
      ATTACHMENT_EXTENSIONS: 'pdf',
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('does not look like a valid email');
  });

  test('warns when no allowlist is configured', () => {
    const result = run({
      FORWARD_TO_EMAIL: 'test@example.com',
      ATTACHMENT_EXTENSIONS: 'pdf',
      ALLOWED_SENDERS: '',
      ALLOWED_DOMAINS: '',
    });
    expect(result.output).toContain('No ALLOWED_SENDERS or ALLOWED_DOMAINS');
  });

  test('fails when sender is in both allowlist and denylist', () => {
    const result = run({
      FORWARD_TO_EMAIL: 'test@example.com',
      ATTACHMENT_EXTENSIONS: 'pdf',
      ALLOWED_SENDERS: 'bad@example.com',
      EXCLUDED_SENDERS: 'bad@example.com',
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('both ALLOWED_SENDERS and EXCLUDED_SENDERS');
  });

  test('fails when domain is in both allowlist and denylist', () => {
    const result = run({
      FORWARD_TO_EMAIL: 'test@example.com',
      ATTACHMENT_EXTENSIONS: 'pdf',
      ALLOWED_DOMAINS: 'example.com',
      EXCLUDED_DOMAINS: 'example.com',
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('both ALLOWED_DOMAINS and EXCLUDED_DOMAINS');
  });

  test('fails when ATTACHMENT_EXTENSIONS is empty', () => {
    const result = run({
      FORWARD_TO_EMAIL: 'test@example.com',
      ATTACHMENT_EXTENSIONS: '',
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('ATTACHMENT_EXTENSIONS');
  });

  test('warns about dot-prefixed extensions', () => {
    const result = run({
      FORWARD_TO_EMAIL: 'test@example.com',
      ATTACHMENT_EXTENSIONS: '.pdf',
    });
    expect(result.output).toContain('dot prefix');
  });

  test('fails when live forwarding enabled without allowlist', () => {
    const result = run({
      FORWARD_TO_EMAIL: 'test@example.com',
      ATTACHMENT_EXTENSIONS: 'pdf',
      ENABLE_LIVE_FORWARDING: 'true',
      ALLOWED_SENDERS: '',
      ALLOWED_DOMAINS: '',
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('no allowlist is configured');
  });

  test('fails when LLM enabled without API key', () => {
    const result = run({
      FORWARD_TO_EMAIL: 'test@example.com',
      ATTACHMENT_EXTENSIONS: 'pdf',
      ENABLE_LLM_CLASSIFICATION: 'true',
      LLM_API_KEY: '',
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('LLM_API_KEY');
  });

  test('fails when LLM confidence threshold is out of range', () => {
    const result = run({
      FORWARD_TO_EMAIL: 'test@example.com',
      ATTACHMENT_EXTENSIONS: 'pdf',
      ENABLE_LLM_CLASSIFICATION: 'true',
      LLM_API_KEY: 'test-key',
      LLM_CONFIDENCE_THRESHOLD: '1.5',
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('LLM_CONFIDENCE_THRESHOLD');
  });

  test('passes with valid LLM config', () => {
    const result = run({
      FORWARD_TO_EMAIL: 'test@example.com',
      ATTACHMENT_EXTENSIONS: 'pdf',
      ENABLE_LLM_CLASSIFICATION: 'true',
      LLM_API_KEY: 'test-key',
      LLM_CONFIDENCE_THRESHOLD: '0.8',
    });
    expect(result.exitCode).toBe(0);
  });

  test('shows correct state for dry-run mode', () => {
    const result = run({
      FORWARD_TO_EMAIL: 'test@example.com',
      ATTACHMENT_EXTENSIONS: 'pdf',
      DRY_RUN: 'true',
      ENABLE_LIVE_FORWARDING: 'false',
      ALLOWED_SENDERS: 'supplier@example.com',
    });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Preview (DRY_RUN)');
  });

  test('shows correct state for live mode', () => {
    const result = run({
      FORWARD_TO_EMAIL: 'test@example.com',
      ATTACHMENT_EXTENSIONS: 'pdf',
      DRY_RUN: 'false',
      ENABLE_LIVE_FORWARDING: 'true',
      ALLOWED_SENDERS: 'supplier@example.com',
    });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('State: Live');
  });
});
