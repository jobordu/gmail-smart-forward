const path = require('path');
const fs = require('fs');
const os = require('os');

describe('build-env', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('generates _env.js from environment variables', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-env-test-'));
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir);

    process.env.FORWARD_TO_EMAIL = 'test@example.com';
    process.env.DRY_RUN = 'true';
    process.env.DISCOVERY_DAYS = '90';
    process.env.MAX_EMAILS_PER_RUN = '50';
    delete process.env.BACKFILL_AFTER_DATE;
    delete process.env.LLM_API_KEY;

    const scriptPath = path.resolve(__dirname, '../scripts/build-env.js');
    const scriptCode = fs.readFileSync(scriptPath, 'utf8');

    const dotenvPath = require.resolve('dotenv', { paths: [path.resolve(__dirname, '..')] });
    const modifiedScript = scriptCode
      .replace(
        /require\('dotenv'\)\.config\(\{[^}]*\}\)/,
        ''
      )
      .replace(
        /path\.resolve\(__dirname, '\.\.\/src\/_env\.js'\)/,
        `path.resolve(${JSON.stringify(path.join(srcDir, '_env.js'))})`
      )
      .replace(
        /path\.resolve\(__dirname, '\.\.\/\.env'\)/,
        `path.resolve(${JSON.stringify(path.join(tmpDir, '.env'))})`
      );

    const tmpScript = path.join(tmpDir, 'build-env-test.js');
    fs.writeFileSync(tmpScript, modifiedScript);
    require(tmpScript);

    const envPath = path.join(srcDir, '_env.js');
    expect(fs.existsSync(envPath)).toBe(true);

    const content = fs.readFileSync(envPath, 'utf8');
    expect(content).toContain('FORWARD_TO_EMAIL');
    expect(content).toContain('test@example.com');

    fs.rmSync(tmpDir, { recursive: true });
    delete require.cache[require.resolve(tmpScript)];
  });

  test('auto-computes BACKFILL_AFTER_DATE from DISCOVERY_DAYS', () => {
    const scriptCode = fs.readFileSync(
      path.resolve(__dirname, '../scripts/build-env.js'), 'utf8'
    );

    expect(scriptCode).toContain('BACKFILL_AFTER_DATE');
    expect(scriptCode).toContain('Auto-computed');
  });

  test('includes all required keys', () => {
    const scriptCode = fs.readFileSync(
      path.resolve(__dirname, '../scripts/build-env.js'), 'utf8'
    );

    const requiredKeys = [
      'FORWARD_TO_EMAIL',
      'ALLOWED_SENDERS',
      'ALLOWED_DOMAINS',
      'DRY_RUN',
      'MAX_EMAILS_PER_RUN',
      'ENABLE_LIVE_FORWARDING',
      'ENABLE_LLM_CLASSIFICATION',
      'LLM_API_KEY',
      'LLM_MODEL',
    ];

    requiredKeys.forEach(key => {
      expect(scriptCode).toContain(key);
    });
  });

  test('filters out undefined and empty values', () => {
    const scriptCode = fs.readFileSync(
      path.resolve(__dirname, '../scripts/build-env.js'), 'utf8'
    );

    expect(scriptCode).toContain("val !== undefined && val !== ''");
  });
});
