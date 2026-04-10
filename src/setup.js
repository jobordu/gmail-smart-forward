// setup.js
// Bootstrap utilities: label setup, trigger creation, config validation.

// Run this once after first deployment to create labels and install the trigger.
function setupAll() {
  validateConfig();
  setupLabels();
  Logger.log('Setup complete. Run discoverSuppliers() next.');
}

function setupLabels() {
  Labels.setup();
}

// Install a time-driven trigger for processLiveEmails() every 15 minutes.
// Safe to call multiple times — will not create duplicates.
function setupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processLiveEmails') {
      Logger.log('Trigger already exists for processLiveEmails. Skipping.');
      return;
    }
  }
  ScriptApp.newTrigger('processLiveEmails')
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log('Time-driven trigger created: processLiveEmails every 15 minutes.');
}

// Remove all triggers for processLiveEmails (kill switch).
function removeTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processLiveEmails') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log('Removed ' + removed + ' trigger(s) for processLiveEmails.');
}

function validateConfig() {
  var errors = [];

  try {
    Config.getForwardToEmail();
  } catch (e) {
    errors.push('FORWARD_TO_EMAIL is not set.');
  }

  var senders = Config.getAllowedSenders();
  var domains = Config.getAllowedDomains();
  if (senders.length === 0 && domains.length === 0) {
    errors.push('No ALLOWED_SENDERS or ALLOWED_DOMAINS set. Discovery will work but backfill/live will forward nothing.');
  }

  if (errors.length > 0) {
    Logger.log('CONFIG WARNINGS:\n' + errors.join('\n'));
  } else {
    Logger.log('Config looks good.');
  }

  Logger.log('Current config: ' + JSON.stringify(Config.dump(), null, 2));
}

// Quick smoke test — does not send any email.
function testSetup() {
  validateConfig();
  setupLabels();
  Logger.log('testSetup: OK');
}
