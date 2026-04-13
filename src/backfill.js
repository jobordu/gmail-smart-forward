/* exported dryRunBackfill, backfillApprovedSuppliers, backfillSender, _shuffle */
// backfill.js
// Historical forwarding. Respects DRY_RUN flag.
// dryRunBackfill() forces dry-run regardless of config.
// backfillApprovedSuppliers() uses config as-is (should set DRY_RUN=false when ready).
// backfillSender(email) processes only emails from a specific sender.

function dryRunBackfill() {
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

function backfillSender(senderEmail) {
  if (!senderEmail) {
    Logger.log('Usage: backfillSender("invoice+statements@stripe.com")');
    return;
  }

  var query = [
    'from:' + senderEmail,
    'filename:pdf',
    '-label:' + Config.getForwardedLabel(),
    '-label:' + Config.getRejectedLabel(),
    '-in:sent',
    '-in:drafts',
  ].join(' ');

  Log.info('Starting sender backfill', { sender: senderEmail, dryRun: Config.isDryRun() });

  var threads = GmailApp.search(query, 0, Config.getMaxEmailsPerRun());
  if (!threads || threads.length === 0) {
    Logger.log('No threads found from ' + senderEmail + ' with PDF attachments.');
    return;
  }

  Log.info('Sender backfill threads found', { sender: senderEmail, count: threads.length });

  var processed = 0;
  var limit = Config.getMaxEmailsPerRun();
  for (var i = 0; i < threads.length && processed < limit; i++) {
    var thread   = threads[i];
    var messages = thread.getMessages();
    if (!messages || messages.length === 0) continue;
    var message  = messages[messages.length - 1];

    var reason = Classifier.classify(thread, message);

    processed++;
    if (reason === null) {
      Forwarding.forwardToTarget(thread);
    } else {
      Forwarding.markRejected(thread, reason);
    }
  }

  Log.info('Sender backfill done', { sender: senderEmail, processed: processed, dryRun: Config.isDryRun() });
  Log.printSummary();
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
  var raw       = GmailSearch.forBackfill(afterDate);
  if (!raw || raw.length === 0) {
    Log.info('Backfill: no threads found');
    Log.printSummary();
    return;
  }
  var threads = _shuffle(raw);
  var limit     = Config.getMaxEmailsPerRun();
  var processed = 0;

  Log.info('Backfill threads to evaluate', { count: threads.length, limit: limit });

  for (var i = 0; i < threads.length && processed < limit; i++) {
    var thread   = threads[i];
    var messages = thread.getMessages();
    if (!messages || messages.length === 0) continue;
    var message  = messages[messages.length - 1];

    var reason = Classifier.classify(thread, message);

    processed++;
    if (reason === null) {
      Forwarding.forwardToTarget(thread);
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
