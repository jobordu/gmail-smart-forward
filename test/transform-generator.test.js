const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const transformPath = path.join(root, 'test/transform/gas-modules.js');
const generatorPath = path.join(root, 'test/transform/generate.js');

describe('transform generator', () => {
  test('generates transform that includes all /* exported */ names', () => {
    execSync('node ' + generatorPath, { cwd: root, encoding: 'utf8' });

    const generated = fs.readFileSync(transformPath, 'utf8');

    const srcFiles = fs.readdirSync(path.join(root, 'src'))
      .filter(f => f.endsWith('.js') && f !== '_env.js');

    const exportedNames = [];
    const exportedFns = [];
    for (const file of srcFiles) {
      const content = fs.readFileSync(path.join(root, 'src', file), 'utf8');
      const exportedRe = /\/\*\s*exported\s+([^*]+)\s*\*\//g;
      let match;
      while ((match = exportedRe.exec(content)) !== null) {
        match[1].split(',').forEach(n => {
          const name = n.trim();
          const isVar = new RegExp('^var ' + name + '[ ]*=', 'm').test(content);
          if (isVar) {
            exportedNames.push(name);
          } else {
            exportedFns.push(name);
          }
        });
      }
    }

    for (const name of exportedNames) {
      expect(generated).toContain('\'' + name + '\'');
    }
    for (const name of exportedFns) {
      expect(generated).toContain('\'' + name + '\'');
    }
  });

  test('generated transform can be loaded as a module', () => {
    execSync('node ' + generatorPath, { cwd: root, encoding: 'utf8' });
    const mod = require(transformPath);
    expect(typeof mod.process).toBe('function');
  });

  test('transform rewrites var declarations for known names', () => {
    execSync('node ' + generatorPath, { cwd: root, encoding: 'utf8' });
    const mod = require(transformPath);
    const result = mod.process('var Config = {};', '/src/config.js');
    expect(result.code).toBe('global.Config = {};');
  });

  test('transform rewrites function declarations for known functions', () => {
    execSync('node ' + generatorPath, { cwd: root, encoding: 'utf8' });
    const mod = require(transformPath);
    const result = mod.process('function setupAll() {}', '/src/setup.js');
    expect(result.code).toBe('global.setupAll = function() {}');
  });

  test('transform skips non-src files', () => {
    execSync('node ' + generatorPath, { cwd: root, encoding: 'utf8' });
    const mod = require(transformPath);
    const src = 'var Config = {};';
    const result = mod.process(src, '/test/something.js');
    expect(result.code).toBe(src);
  });

  test('transform skips json files', () => {
    execSync('node ' + generatorPath, { cwd: root, encoding: 'utf8' });
    const mod = require(transformPath);
    const src = 'var Config = {};';
    const result = mod.process(src, '/src/appsscript.json');
    expect(result.code).toBe(src);
  });
});
