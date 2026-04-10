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

  // Return only the messages that have an allowed attachment AND were sent
  // by an allowlisted sender. Prevents forwarding PDFs from non-approved
  // senders who happen to reply in a thread started by an approved supplier.
  function _messagesWithAttachment(thread) {
    return thread.getMessages().filter(function (msg) {
      if (!Classifier.isSupplierAllowed(msg)) return false;
      var attachments = msg.getAttachments();
      for (var i = 0; i < attachments.length; i++) {
        if (Classifier._hasAllowedExtension(attachments[i].getName())) return true;
      }
      return false;
    });
  }

  return {
    // Forward only the message(s) in the thread that contain an allowed attachment.
    // If a thread has multiple qualifying messages (e.g. original invoice + revised copy),
    // each is forwarded individually.
    forwardToTarget: function (thread) {
      var targets = _messagesWithAttachment(thread);

      targets.forEach(function (message) {
        _forward(message, thread);
      });

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
