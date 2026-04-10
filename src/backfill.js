// backfill.js
// Historical forwarding. Respects DRY_RUN flag.
// dryRunBackfill() forces dry-run regardless of config.
// backfillApprovedSuppliers() uses config as-is (should set DRY_RUN=false when ready).

function dryRunBackfill() {
  // Temporarily override isDryRun for this call
  var realIsDryRun = Config.isDryRun;
  Config.isDryRun = function () { return true; };
  try {
    Log.info('Starting DRY RUN backfill (forced dry-run)');
    _runBackfill();
  } finally {
    Config.isDryRun = realIsDryRun;
  }
}

function backfillApprovedSuppliers() {
  if (Config.isDryRun()) {
    Logger.log('DRY_RUN is true — running in dry-run mode. Set DRY_RUN=false in Script Properties to forward for real.');
  }
  Log.info('Starting backfill', { dryRun: Config.isDryRun() });
  _runBackfill();
}

function _runBackfill() {
  var afterDate = Config.getBackfillAfterDate();
  var threads   = GmailSearch.forBackfill(afterDate);
  var limit     = Config.getMaxEmailsPerRun();
  var processed = 0;

  Log.info('Backfill threads to evaluate', { count: threads.length, limit: limit });

  for (var i = 0; i < threads.length && processed < limit; i++) {
    var thread   = threads[i];
    var messages = thread.getMessages();
    var message  = messages[messages.length - 1];

    var reason = Classifier.classify(thread, message);

    if (reason === null) {
      Forwarding.forwardToTarget(thread);
      processed++;
    } else {
      // Only log rejections — don't apply the rejected label during backfill
      // to keep the inbox clean. Only label what was actually forwarded.
      var m = messages[messages.length - 1];
      Log.rejected(m, thread, reason);
    }
  }

  Log.info('Backfill done', { processed: processed, dryRun: Config.isDryRun() });
  Log.printSummary();
}
