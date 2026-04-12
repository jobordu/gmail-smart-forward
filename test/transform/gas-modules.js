const knownNames = new Set([
  'LABEL_NAMES',
  'DEFAULT_SUBJECT_KEYWORDS',
  'DEFAULT_ATTACHMENT_KEYWORDS',
  'DEFAULT_EXCLUDED_KEYWORDS',
  'DEFAULT_ATTACHMENT_EXTENSIONS',
  'DEFAULT_DISCOVERY_DAYS',
  'DEFAULT_MAX_EMAILS_PER_RUN',
  'DEFAULT_DRY_RUN',
  'Config',
  'Log',
  'Labels',
  'GmailSearch',
  'Classifier',
  'LlmClassifier',
  'Forwarding',
  '_ENV',
]);

const knownFunctions = new Set([
  'discoverSuppliers',
  'dryRunBackfill',
  'backfillApprovedSuppliers',
  '_shuffle',
  '_runBackfill',
  'backfillSender',
  'processLiveEmails',
  'bootstrapProperties',
  'setupAll',
  'setupLabels',
  'setupTrigger',
  'removeTrigger',
  'validateConfig',
  'migrateLabels',
  'clearAllLabels',
  'testSetup',
  'status',
]);

module.exports = {
  process(src, filename) {
    if (!filename.includes('/src/') || filename.endsWith('.json')) {
      return { code: src, map: null };
    }

    let code = src;

    for (const name of knownNames) {
      const re = new RegExp('^var ' + name + '[ ]*=', 'gm');
      code = code.replace(re, 'global.' + name + ' =');
    }

    for (const name of knownFunctions) {
      const re = new RegExp('^function ' + name + '\\(', 'gm');
      code = code.replace(re, 'global.' + name + ' = function(');
    }

    return { code, map: null };
  },
};
