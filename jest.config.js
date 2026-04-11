module.exports = {
  testEnvironment: 'node',
  setupFiles: [
    '<rootDir>/test/setup/gas-mocks.js',
    '<rootDir>/test/setup/load-modules.js',
  ],
  transform: {
    '\\.js$': '<rootDir>/test/transform/gas-modules.js',
  },
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/_env.js',
    '!src/appsscript.json',
  ],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  coveragePathIgnorePatterns: [
    'node_modules',
    '_env\\.js$',
    'appsscript\\.json$',
  ],
};
