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

function _shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function _runBackfill() {
  var afterDate = Config.getBackfillAfterDate();
  var threads   = _shuffle(GmailSearch.forBackfill(afterDate));
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
      // Label rejections so subsequent runs skip already-evaluated threads
      // (idempotency). Only threads not yet labeled forwarded or rejected
      // will appear in the next run's candidate pool.
      Forwarding.markRejected(thread, reason);
    }
  }

  Log.info('Backfill done', { processed: processed, dryRun: Config.isDryRun() });
  Log.printSummary();
}
