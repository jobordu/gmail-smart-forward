/* exported Classifier */
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

    // True if a filename ends with one of the allowed extensions.
    _hasAllowedExtension: function (filename) {
      var extensions = Config.getAttachmentExtensions();
      var lower = filename.toLowerCase();
      for (var i = 0; i < extensions.length; i++) {
        if (lower.endsWith('.' + extensions[i])) return true;
      }
      return false;
    },

    // True if any message in the thread has at least one allowed attachment.
    // Scans all messages so attachments in earlier messages are not missed.
    threadHasAllowedAttachment: function (thread) {
      var messages = thread.getMessages();
      for (var i = 0; i < messages.length; i++) {
        var attachments = messages[i].getAttachments();
        for (var j = 0; j < attachments.length; j++) {
          if (Classifier._hasAllowedExtension(attachments[j].getName())) return true;
        }
      }
      return false;
    },

    // Returns null if thread should be forwarded, or a rejection reason string.
    // Requires at least one allowed attachment (e.g. PDF) somewhere in the thread.
    // excluded-keyword is intentionally NOT checked for allowlisted senders —
    // words like "unsubscribe" in footers or "sale" in "Sales Invoice" cause
    // false positives on legitimate invoices from approved suppliers.
    classify: function (thread, message) {
      if (Classifier.hasAlreadyBeenForwarded(thread))       return 'already-forwarded';
      if (Classifier.isExcludedSender(message))              return 'excluded-sender';
      // If the latest message's sender is not allowlisted, scan all messages
      // in the thread. Supports daisy-chain forwarding where multiple people
      // forward invoices through gmail-smart-forward in sequence.
      if (!Classifier.isSupplierAllowed(message)) {
        var allowed = Classifier.findAllowlistedMessage(thread);
        if (!allowed) return 'sender-not-allowlisted';
        message = allowed;
      }
      if (!Classifier.threadHasAllowedAttachment(thread))    return 'no-allowed-attachment';

      if (Config.isLlmEnabled()) {
        try {
          var result = LlmClassifier.classifyInvoice(message, thread);
          var threshold = Config.getLlmConfidenceThreshold();
          if (!result.is_invoice || result.confidence < threshold) {
            Log.info('LLM rejected: confidence=' + result.confidence + ' reason=' + result.reason);
            return 'llm-not-invoice';
          }
        } catch (e) {
          // Fail-open: log the error but do not block forwarding
          Log.info('LLM classification error (skipping): ' + e.message);
        }
      }

      return null; // null = should forward
    },

    // Find the most recent allowlisted, non-excluded message in a thread.
    // Returns the message, or null if none found.
    findAllowlistedMessage: function (thread) {
      var messages = thread.getMessages();
      for (var i = messages.length - 1; i >= 0; i--) {
        if (Classifier.isSupplierAllowed(messages[i]) && !Classifier.isExcludedSender(messages[i])) {
          return messages[i];
        }
      }
      return null;
    },

    // Expose helper for discovery reporting
    getSenderEmail:  _senderEmail,
    getSenderDomain: _senderDomain,
  };
})();
