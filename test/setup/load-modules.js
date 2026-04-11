const path = require('path');

const moduleOrder = [
  'constants.js',
  'config.js',
  'logging.js',
  'labels.js',
  'gmail-search.js',
  'llm.js',
  'classifier.js',
  'forwarding.js',
  'discovery.js',
  'backfill.js',
  'live.js',
  'setup.js',
];

for (const file of moduleOrder) {
  require(path.resolve(__dirname, '../../src', file));
}
