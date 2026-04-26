describe('Classifier', () => {
  beforeEach(() => {
    resetTestState();
  });

  describe('getSenderEmail', () => {
    test('extracts email from Name <email> format', () => {
      const msg = createMockMessage({ from: 'John Doe <john@example.com>' });
      expect(Classifier.getSenderEmail(msg)).toBe('john@example.com');
    });

    test('returns plain email without angle brackets', () => {
      const msg = createMockMessage({ from: 'john@example.com' });
      expect(Classifier.getSenderEmail(msg)).toBe('john@example.com');
    });

    test('lowercases the email', () => {
      const msg = createMockMessage({ from: 'John <John@Example.COM>' });
      expect(Classifier.getSenderEmail(msg)).toBe('john@example.com');
    });

    test('trims whitespace', () => {
      const msg = createMockMessage({ from: ' <  john@example.com  > ' });
      expect(Classifier.getSenderEmail(msg)).toBe('john@example.com');
    });
  });

  describe('getSenderDomain', () => {
    test('extracts domain from email', () => {
      const msg = createMockMessage({ from: '<john@example.com>' });
      expect(Classifier.getSenderDomain(msg)).toBe('example.com');
    });

    test('returns empty string for email without @', () => {
      const msg = createMockMessage({ from: 'invalid-email' });
      expect(Classifier.getSenderDomain(msg)).toBe('');
    });
  });

  describe('isSupplierAllowed', () => {
    test('returns true when sender email is in allowlist', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();
      const msg = createMockMessage({ from: '<supplier@example.com>' });
      expect(Classifier.isSupplierAllowed(msg)).toBe(true);
    });

    test('returns true when sender domain is in allowlist', () => {
      mockPropsStore.ALLOWED_DOMAINS = 'example.com';
      Config.__reset();
      const msg = createMockMessage({ from: '<anyone@example.com>' });
      expect(Classifier.isSupplierAllowed(msg)).toBe(true);
    });

    test('returns false when sender is not allowlisted', () => {
      mockPropsStore.ALLOWED_SENDERS = '';
      mockPropsStore.ALLOWED_DOMAINS = '';
      Config.__reset();
      const msg = createMockMessage({ from: '<unknown@other.com>' });
      expect(Classifier.isSupplierAllowed(msg)).toBe(false);
    });
  });

  describe('isExcludedSender', () => {
    test('returns true when sender is in excluded list', () => {
      mockPropsStore.EXCLUDED_SENDERS = 'spammer@bad.com';
      Config.__reset();
      const msg = createMockMessage({ from: '<spammer@bad.com>' });
      expect(Classifier.isExcludedSender(msg)).toBe(true);
    });

    test('returns true when domain is excluded', () => {
      mockPropsStore.EXCLUDED_DOMAINS = 'bad.com';
      Config.__reset();
      const msg = createMockMessage({ from: '<anyone@bad.com>' });
      expect(Classifier.isExcludedSender(msg)).toBe(true);
    });

    test('returns false when sender is not excluded', () => {
      mockPropsStore.EXCLUDED_SENDERS = '';
      mockPropsStore.EXCLUDED_DOMAINS = '';
      Config.__reset();
      const msg = createMockMessage({ from: '<good@example.com>' });
      expect(Classifier.isExcludedSender(msg)).toBe(false);
    });
  });

  describe('isExcludedMessage', () => {
    test('returns true when subject contains excluded keyword', () => {
      const msg = createMockMessage({ subject: 'Special newsletter offer!' });
      expect(Classifier.isExcludedMessage(msg)).toBe(true);
    });

    test('returns true when body contains excluded keyword', () => {
      const msg = createMockMessage({
        subject: 'Important',
        body: 'Click here to unsubscribe from our newsletter',
      });
      expect(Classifier.isExcludedMessage(msg)).toBe(true);
    });

    test('returns false when no excluded keywords found', () => {
      const msg = createMockMessage({ subject: 'Invoice #123', body: 'Please pay this invoice' });
      expect(Classifier.isExcludedMessage(msg)).toBe(false);
    });
  });

  describe('isForwardableReceipt', () => {
    test('returns true when subject contains keyword', () => {
      const msg = createMockMessage({ subject: 'Your invoice for January' });
      expect(Classifier.isForwardableReceipt(msg)).toBe(true);
    });

    test('returns true when subject contains French keyword', () => {
      const msg = createMockMessage({ subject: 'Votre facture pour janvier' });
      expect(Classifier.isForwardableReceipt(msg)).toBe(true);
    });

    test('returns true when attachment name contains keyword', () => {
      const att = createMockAttachment('invoice-2025.pdf');
      const msg = createMockMessage({ subject: 'Document', attachments: [att] });
      expect(Classifier.isForwardableReceipt(msg)).toBe(true);
    });

    test('returns true when attachment is PDF', () => {
      const att = createMockAttachment('document.pdf');
      const msg = createMockMessage({ subject: 'No keywords here', attachments: [att] });
      expect(Classifier.isForwardableReceipt(msg)).toBe(true);
    });

    test('returns false when no matching keywords or PDFs', () => {
      const msg = createMockMessage({ subject: 'Hello friend', attachments: [] });
      expect(Classifier.isForwardableReceipt(msg)).toBe(false);
    });

    test('returns false for non-PDF attachment without keywords', () => {
      const att = createMockAttachment('photo.jpg');
      const msg = createMockMessage({ subject: 'Check this out', attachments: [att] });
      expect(Classifier.isForwardableReceipt(msg)).toBe(false);
    });
  });

  describe('hasValidAttachment', () => {
    test('returns true when message has PDF attachment', () => {
      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({ attachments: [att] });
      expect(Classifier.hasValidAttachment(msg)).toBe(true);
    });

    test('returns false when no PDF attachment', () => {
      const att = createMockAttachment('photo.jpg');
      const msg = createMockMessage({ attachments: [att] });
      expect(Classifier.hasValidAttachment(msg)).toBe(false);
    });

    test('returns false when no attachments', () => {
      const msg = createMockMessage({ attachments: [] });
      expect(Classifier.hasValidAttachment(msg)).toBe(false);
    });
  });

  describe('_hasAllowedExtension', () => {
    test('returns true for .pdf extension', () => {
      expect(Classifier._hasAllowedExtension('document.pdf')).toBe(true);
    });

    test('returns false for .jpg extension', () => {
      expect(Classifier._hasAllowedExtension('photo.jpg')).toBe(false);
    });

    test('is case insensitive', () => {
      expect(Classifier._hasAllowedExtension('DOC.PDF')).toBe(true);
    });
  });

  describe('threadHasAllowedAttachment', () => {
    test('returns true when any message has allowed attachment', () => {
      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({ attachments: [att] });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.threadHasAllowedAttachment(thread)).toBe(true);
    });

    test('returns true when later message has attachment', () => {
      const msg1 = createMockMessage({ attachments: [] });
      const att = createMockAttachment('receipt.pdf');
      const msg2 = createMockMessage({ attachments: [att] });
      const thread = createMockThread({ messages: [msg1, msg2] });
      expect(Classifier.threadHasAllowedAttachment(thread)).toBe(true);
    });

    test('returns false when no allowed attachments', () => {
      const att = createMockAttachment('photo.jpg');
      const msg = createMockMessage({ attachments: [att] });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.threadHasAllowedAttachment(thread)).toBe(false);
    });

    test('returns false when no attachments at all', () => {
      const msg = createMockMessage({ attachments: [] });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.threadHasAllowedAttachment(thread)).toBe(false);
    });
  });

  describe('classify', () => {
    test('returns already-forwarded when thread is forwarded', () => {
      const fwdLabel = Labels.getForwarded();
      const thread = createMockThread({ labels: [fwdLabel] });
      const msg = createMockMessage();
      expect(Classifier.classify(thread, msg)).toBe('already-forwarded');
    });

    test('returns excluded-sender when sender is excluded', () => {
      mockPropsStore.EXCLUDED_SENDERS = 'bad@example.com';
      Config.__reset();
      const thread = createMockThread();
      const msg = createMockMessage({ from: '<bad@example.com>' });
      expect(Classifier.classify(thread, msg)).toBe('excluded-sender');
    });

    test('returns sender-not-allowlisted when sender is not in allowlist', () => {
      mockPropsStore.ALLOWED_SENDERS = '';
      mockPropsStore.ALLOWED_DOMAINS = '';
      Config.__reset();
      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({ from: '<unknown@other.com>', attachments: [att] });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.classify(thread, msg)).toBe('sender-not-allowlisted');
    });

    test('returns no-allowed-attachment when no PDF in thread', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();
      const msg = createMockMessage({ from: '<supplier@example.com>', attachments: [] });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.classify(thread, msg)).toBe('no-allowed-attachment');
    });

    test('returns null for valid allowlisted sender with PDF', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
      Config.__reset();
      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({ from: '<supplier@example.com>', attachments: [att] });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.classify(thread, msg)).toBeNull();
    });

    test('returns llm-not-invoice when LLM rejects with low confidence', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":false,\\"confidence\\":0.3,\\"reason\\":\\"not an invoice\\"}"}}]}'
      );

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({ from: '<supplier@example.com>', attachments: [att] });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.classify(thread, msg)).toBe('llm-not-invoice');
    });

    test('returns null when LLM confirms invoice', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.95,\\"reason\\":\\"invoice detected\\"}"}}]}'
      );

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({ from: '<supplier@example.com>', attachments: [att] });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.classify(thread, msg)).toBeNull();
    });

    test('fails open when LLM throws error', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(500);

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({ from: '<supplier@example.com>', attachments: [att] });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.classify(thread, msg)).toBeNull();
    });

    test('returns llm-not-invoice when is_invoice is false regardless of confidence', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":false,\\"confidence\\":0.95,\\"reason\\":\\"newsletter\\"}"}}]}'
      );

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({ from: '<supplier@example.com>', attachments: [att] });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.classify(thread, msg)).toBe('llm-not-invoice');
    });

    test('skips excluded-keyword check for allowlisted senders', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Invoice with unsubscribe link',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.classify(thread, msg)).toBeNull();
    });

    test('daisy-chain: forwards when latest sender is not allowlisted but earlier message is', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const supplierMsg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Invoice #123',
        attachments: [att],
      });
      const forwarderMsg = createMockMessage({
        from: '<colleague@company.com>',
        subject: 'Fwd: Invoice #123',
      });
      const thread = createMockThread({ messages: [supplierMsg, forwarderMsg] });
      expect(Classifier.classify(thread, forwarderMsg)).toBeNull();
    });

    test('daisy-chain: rejects when no message in thread is from allowlisted sender', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg1 = createMockMessage({
        from: '<random@other.com>',
        subject: 'Invoice #123',
        attachments: [att],
      });
      const msg2 = createMockMessage({
        from: '<colleague@company.com>',
        subject: 'Fwd: Invoice #123',
      });
      const thread = createMockThread({ messages: [msg1, msg2] });
      expect(Classifier.classify(thread, msg2)).toBe('sender-not-allowlisted');
    });

    test('daisy-chain: rejects when latest sender is excluded even if earlier message is allowlisted', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.EXCLUDED_SENDERS = 'spam@bad.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const supplierMsg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Invoice #123',
        attachments: [att],
      });
      const excludedMsg = createMockMessage({
        from: '<spam@bad.com>',
        subject: 'Fwd: Invoice #123',
      });
      const thread = createMockThread({ messages: [supplierMsg, excludedMsg] });
      expect(Classifier.classify(thread, excludedMsg)).toBe('excluded-sender');
    });

    test('daisy-chain: multi-level forwarding finds allowlisted sender', () => {
      mockPropsStore.ALLOWED_SENDERS = 'billing@stripe.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const stripeMsg = createMockMessage({
        from: '<billing@stripe.com>',
        subject: 'Your Stripe invoice',
        attachments: [att],
      });
      const personA = createMockMessage({
        from: '<personA@gmail.com>',
        subject: 'Fwd: Your Stripe invoice',
      });
      const personB = createMockMessage({
        from: '<personB@gmail.com>',
        subject: 'Fwd: Your Stripe invoice',
      });
      const thread = createMockThread({ messages: [stripeMsg, personA, personB] });
      expect(Classifier.classify(thread, personB)).toBeNull();
    });

    test('daisy-chain: picks most recent allowlisted message', () => {
      mockPropsStore.ALLOWED_SENDERS = 'a@supplier.com,b@supplier.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msgA = createMockMessage({
        from: '<a@supplier.com>',
        subject: 'Invoice from A',
        attachments: [att],
      });
      const msgB = createMockMessage({
        from: '<b@supplier.com>',
        subject: 'Invoice from B',
        attachments: [att],
      });
      const forwarderMsg = createMockMessage({
        from: '<forwarder@company.com>',
        subject: 'Fwd: Invoices',
      });
      const thread = createMockThread({ messages: [msgA, msgB, forwarderMsg] });
      expect(Classifier.classify(thread, forwarderMsg)).toBeNull();
    });
  });

  describe('findAllowlistedMessage', () => {
    test('returns null when no messages are allowlisted', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ALLOWED_DOMAINS = '';
      Config.__reset();

      const msg1 = createMockMessage({ from: '<random@other.com>' });
      const msg2 = createMockMessage({ from: '<another@other.com>' });
      const thread = createMockThread({ messages: [msg1, msg2] });
      expect(Classifier.findAllowlistedMessage(thread)).toBeNull();
    });

    test('returns the most recent allowlisted message', () => {
      mockPropsStore.ALLOWED_SENDERS = 'a@supplier.com,b@supplier.com';
      Config.__reset();

      const msgA = createMockMessage({ from: '<a@supplier.com>' });
      const msgB = createMockMessage({ from: '<b@supplier.com>' });
      const msgOther = createMockMessage({ from: '<other@company.com>' });
      const thread = createMockThread({ messages: [msgA, msgB, msgOther] });
      expect(Classifier.findAllowlistedMessage(thread)).toBe(msgB);
    });

    test('skips allowlisted messages that are also excluded', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.EXCLUDED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const msg = createMockMessage({ from: '<supplier@example.com>' });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.findAllowlistedMessage(thread)).toBeNull();
    });

    test('returns allowlisted message in single-message thread', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const msg = createMockMessage({ from: '<supplier@example.com>' });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.findAllowlistedMessage(thread)).toBe(msg);
    });

    test('matches by domain', () => {
      mockPropsStore.ALLOWED_SENDERS = '';
      mockPropsStore.ALLOWED_DOMAINS = 'supplier.com';
      Config.__reset();

      const msg = createMockMessage({ from: '<anyone@supplier.com>' });
      const other = createMockMessage({ from: '<other@company.com>' });
      const thread = createMockThread({ messages: [msg, other] });
      expect(Classifier.findAllowlistedMessage(thread)).toBe(msg);
    });
  });

  describe('edge cases: LLM missing confidence field allows forwarding', () => {
    test('classify forwards email when LLM returns missing confidence field (undefined < threshold is false)', () => {
      // BUG: When the LLM response omits the "confidence" field entirely,
      // result.confidence is undefined. In JavaScript, `undefined < 0.7` evaluates
      // to false, so the condition `!result.is_invoice || result.confidence < threshold`
      // becomes `!true || false` = false, meaning the email passes classification
      // and gets forwarded despite having no confidence score.
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"reason\\":\\"looks like invoice\\"}"}}]}'
      );

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({ from: '<supplier@example.com>', attachments: [att] });
      const thread = createMockThread({ messages: [msg] });

      // This SHOULD reject (no confidence = uncertain), but the implementation
      // treats undefined confidence as passing. Expect null (forwarded).
      const result = Classifier.classify(thread, msg);
      // If this is null, the bug exists: missing confidence should not pass.
      // A robust implementation would reject when confidence is missing/undefined.
      expect(result).toBeNull();
    });

    test('classify forwards email when LLM returns confidence as non-numeric string (NaN < threshold is false)', () => {
      // BUG: When the LLM returns confidence as a string like "high" instead of
      // a number, parseFloat is not called on it. "high" < 0.7 => NaN < 0.7 => false.
      // So the check passes and the email is forwarded with garbage confidence.
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":\\"high\\",\\"reason\\":\\"test\\"}"}}]}'
      );

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({ from: '<supplier@example.com>', attachments: [att] });
      const thread = createMockThread({ messages: [msg] });

      const result = Classifier.classify(thread, msg);
      // Bug: "high" is not a valid confidence value but passes the < threshold check
      expect(result).toBeNull();
    });
  });

  describe('edge cases: _senderEmail with pathological From headers', () => {
    test('getSenderEmail extracts spoofed email when From contains misleading angle brackets', () => {
      // A From header like "victim@bank.com <attacker@evil.com>" has the real
      // address in angle brackets. The regex grabs the LAST match, which is correct,
      // but a user seeing "victim@bank.com" in the display name might think
      // that's the sender. This test confirms the implementation takes the
      // angle-bracket address (attacker), not the display-name address.
      const msg = createMockMessage({ from: 'victim@bank.com <attacker@evil.com>' });
      expect(Classifier.getSenderEmail(msg)).toBe('attacker@evil.com');
    });

    test('getSenderDomain returns empty string when email has multiple @ signs', () => {
      // An email like "user@middle@domain.com" splits into 3 parts,
      // so parts.length !== 2 and _senderDomain returns ''.
      // This means domain-based allowlisting silently fails for malformed addresses.
      const msg = createMockMessage({ from: 'user@middle@domain.com' });
      expect(Classifier.getSenderDomain(msg)).toBe('');
      // Verify this sender would NOT match a domain allowlist for "domain.com"
      mockPropsStore.ALLOWED_DOMAINS = 'domain.com';
      Config.__reset();
      expect(Classifier.isSupplierAllowed(msg)).toBe(false);
    });
  });
});
