/* exported processLiveEmails */
// live.js
// Scheduled processing for new/current emails.
// Called by a time-driven trigger every 10–15 minutes.

function processLiveEmails() {
  if (!Config.isLiveForwardingEnabled()) {
    Logger.log('Live forwarding is disabled (ENABLE_LIVE_FORWARDING=false). Exiting.');
    return;
  }

  Log.info('Live run started');

  // Look back slightly further than the trigger interval to avoid gaps
  var LOOK_BACK_MINUTES = 20;
  var threads = GmailSearch.forLive(LOOK_BACK_MINUTES);
  var limit   = Config.getMaxEmailsPerRun();
  var processed = 0;

  Log.info('Threads to evaluate', { count: threads.length });

  for (var i = 0; i < threads.length && processed < limit; i++) {
    var thread   = threads[i];
    var messages = thread.getMessages();
    var message  = messages[messages.length - 1];

    var reason = Classifier.classify(thread, message);

    if (reason === null) {
      Forwarding.forwardToTarget(thread);
      processed++;
    } else if (reason !== 'already-forwarded') {
      Labels.applyRejected(thread);
      var m = messages[messages.length - 1];
      Log.rejected(m, thread, reason);
    }
  }

  Log.info('Live run done', { processed: processed });
  Log.printSummary();
}
