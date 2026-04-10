// forwarding.js
// Actual email forwarding and thread marking.

var Forwarding = (function () {

  // Forward a single message to the configured target email.
  // In dry-run mode, only logs — never actually sends.
  function _forward(message, thread) {
    var to = Config.getForwardToEmail();

    if (Config.isDryRun()) {
      Log.forwarded(message, thread);
      Log.info('DRY RUN — would forward to ' + to, {
        subject: message.getSubject(),
        from: message.getFrom(),
      });
      return;
    }

    message.forward(to);
    Log.forwarded(message, thread);
  }

  return {
    // Forward the most recent message in a thread and mark it.
    forwardToTarget: function (thread) {
      var messages = thread.getMessages();
      var message  = messages[messages.length - 1]; // newest message

      _forward(message, thread);

      if (!Config.isDryRun()) {
        Labels.applyForwarded(thread);
      }
    },

    // Mark a thread as rejected with a reason label.
    markRejected: function (thread, reason) {
      Labels.applyRejected(thread);
      var messages = thread.getMessages();
      var message  = messages[messages.length - 1];
      Log.rejected(message, thread, reason);
    },
  };
})();
