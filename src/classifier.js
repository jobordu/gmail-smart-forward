// classifier.js
// Core classification logic. All functions return boolean or a reason string.

var Classifier = (function () {

  function _senderEmail(message) {
    var from = message.getFrom();
    // Extract email from "Name <email>" format
    var match = from.match(/<([^>]+)>/);
    return (match ? match[1] : from).toLowerCase().trim();
  }

  function _senderDomain(message) {
    var email = _senderEmail(message);
    var parts = email.split('@');
    return parts.length === 2 ? parts[1] : '';
  }

  function _containsKeyword(text, keywords) {
    var lower = text.toLowerCase();
    for (var i = 0; i < keywords.length; i++) {
      if (lower.indexOf(keywords[i]) !== -1) return keywords[i];
    }
    return null;
  }

  function _attachmentNames(message) {
    return message.getAttachments().map(function (a) {
      return a.getName().toLowerCase();
    });
  }

  return {
    // True if sender email or domain is in the allowlist
    isSupplierAllowed: function (message) {
      var email  = _senderEmail(message);
      var domain = _senderDomain(message);
      var senders = Config.getAllowedSenders();
      var domains = Config.getAllowedDomains();
      return senders.indexOf(email) !== -1 || domains.indexOf(domain) !== -1;
    },

    // True if sender is in the denylist
    isExcludedSender: function (message) {
      var email  = _senderEmail(message);
      var domain = _senderDomain(message);
      var excSenders = Config.getExcludedSenders();
      var excDomains = Config.getExcludedDomains();
      return excSenders.indexOf(email) !== -1 || excDomains.indexOf(domain) !== -1;
    },

    // True if subject or body contains an excluded keyword
    isExcludedMessage: function (message) {
      var subject = message.getSubject();
      var body    = message.getPlainBody();
      var kw = Config.getExcludedKeywords();
      return !!(_containsKeyword(subject, kw) || _containsKeyword(body, kw));
    },

    // True if message looks like a receipt/invoice via subject or attachment
    isForwardableReceipt: function (message) {
      var subject = message.getSubject();
      var subjectKw = Config.getSubjectKeywords();
      if (_containsKeyword(subject, subjectKw)) return true;

      var attachKw = Config.getAttachmentKeywords();
      var names = _attachmentNames(message);
      for (var i = 0; i < names.length; i++) {
        if (_containsKeyword(names[i], attachKw)) return true;
        // Any PDF counts as strong signal
        if (names[i].endsWith('.pdf')) return true;
      }
      return false;
    },

    // True if message has at least one PDF attachment
    hasValidAttachment: function (message) {
      var attachments = message.getAttachments();
      for (var i = 0; i < attachments.length; i++) {
        var name = attachments[i].getName().toLowerCase();
        if (name.endsWith('.pdf')) return true;
      }
      return false;
    },

    // True if the thread is already marked as forwarded
    hasAlreadyBeenForwarded: function (thread) {
      return Labels.isForwarded(thread);
    },

    // True if any message in the thread has a receipt signal (PDF or keyword).
    // Checks all messages so reply threads don't lose their attachment signal.
    threadHasReceiptSignal: function (thread) {
      var messages = thread.getMessages();
      for (var i = 0; i < messages.length; i++) {
        if (Classifier.isForwardableReceipt(messages[i])) return true;
      }
      return false;
    },

    // Returns null if thread should be forwarded, or a rejection reason string.
    // excluded-keyword is intentionally NOT checked for allowlisted senders —
    // words like "unsubscribe" in footers or "sale" in "Sales Invoice" cause
    // false positives on legitimate invoices from approved suppliers.
    classify: function (thread, message) {
      if (Classifier.hasAlreadyBeenForwarded(thread))    return 'already-forwarded';
      if (Classifier.isExcludedSender(message))           return 'excluded-sender';
      if (!Classifier.isSupplierAllowed(message))         return 'sender-not-allowlisted';
      if (!Classifier.threadHasReceiptSignal(thread))     return 'no-receipt-signal';
      return null; // null = should forward
    },

    // Expose helper for discovery reporting
    getSenderEmail:  _senderEmail,
    getSenderDomain: _senderDomain,
  };
})();
