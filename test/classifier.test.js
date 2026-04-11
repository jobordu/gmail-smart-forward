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
  });
});
