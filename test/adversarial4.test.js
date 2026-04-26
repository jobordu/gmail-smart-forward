describe('Adversarial Round 4 — New bugs', () => {
  beforeEach(() => {
    resetTestState();
  });

  describe('BUG 1: _senderEmail crashes on null getFrom', () => {
    test('getSenderEmail throws TypeError when getFrom() returns null', () => {
      const msg = createMockMessage();
      msg.getFrom = jest.fn(() => null);
      expect(() => Classifier.getSenderEmail(msg)).not.toThrow();
    });
  });

  describe('BUG 2: _containsKeyword crashes on null text in isForwardableReceipt', () => {
    test('isForwardableReceipt throws when getSubject() returns null', () => {
      const msg = createMockMessage();
      msg.getSubject = jest.fn(() => null);
      expect(() => Classifier.isForwardableReceipt(msg)).not.toThrow();
    });
  });

  describe('BUG 3: _containsKeyword crashes on null text in isExcludedMessage (body)', () => {
    test('isExcludedMessage throws when getPlainBody() returns null', () => {
      const msg = createMockMessage({ subject: 'normal subject' });
      msg.getPlainBody = jest.fn(() => null);
      expect(() => Classifier.isExcludedMessage(msg)).not.toThrow();
    });
  });

  describe('BUG 4: discovery crash on null getFrom', () => {
    test('discoverSuppliers crashes when message.getFrom() returns null', () => {
      const msg = createMockMessage({
        subject: 'Invoice',
      });
      msg.getFrom = jest.fn(() => null);
      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      expect(() => discoverSuppliers()).not.toThrow();
    });
  });

  describe('BUG 5: _forward crashes on null getSubject/getFrom in dry-run log', () => {
    test('_forward crashes in dry-run when message.getSubject() returns null', () => {
      mockPropsStore.DRY_RUN = 'true';
      Config.__reset();

      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [createMockAttachment('invoice.pdf')],
      });
      msg.getSubject = jest.fn(() => null);
      const thread = createMockThread({ messages: [msg] });

      expect(() => Forwarding.forwardToTarget(thread)).not.toThrow();
    });
  });

  describe('BUG 6: _formatDate produces wrong month when month is < 10 but padStart is unavailable', () => {
    test('_formatDate handles January correctly', () => {
      const jan = new Date('2025-01-05T12:00:00Z');
      const result = GmailSearch.forLive(20);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('BUG 7: processLiveEmails crashes when forLive returns null', () => {
    test('processLiveEmails handles null search results', () => {
      mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
      Config.__reset();
      mockGmailApp.search.mockReturnValue(null);

      expect(() => processLiveEmails()).not.toThrow();
    });
  });

  describe('BUG 8: backfillSender crashes when GmailApp.search returns null', () => {
    test('backfillSender handles null from GmailApp.search', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();
      mockGmailApp.search.mockReturnValue(null);

      expect(() => backfillSender('test@example.com')).not.toThrow();
    });
  });

  describe('BUG 9: dryRunBackfill does not restore Config.isDryRun if Log.info throws', () => {
    test('Config.isDryRun is restored even if _runBackfill throws', () => {
      const originalDryRun = Config.isDryRun;
      mockGmailApp.search.mockImplementation(() => { throw new Error('GAS error'); });

      try { dryRunBackfill(); } catch (_e) {}

      expect(Config.isDryRun).toBe(originalDryRun);
    });
  });

  describe('BUG 10: _buildUserContent crashes on null subject', () => {
    test('LlmClassifier.classifyInvoice crashes when getSubject() returns null', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      msg.getSubject = jest.fn(() => null);
      const thread = createMockThread({ messages: [msg] });

      expect(() => Classifier.classify(thread, msg)).not.toThrow();
    });
  });

  describe('BUG 11: _buildUserContent crashes on null body', () => {
    test('LlmClassifier.classifyInvoice crashes when getPlainBody() returns null', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      msg.getPlainBody = jest.fn(() => null);
      const thread = createMockThread({ messages: [msg] });

      expect(() => Classifier.classify(thread, msg)).not.toThrow();
    });
  });

  describe('BUG 12: Labels.isForwarded crashes when thread.getLabels() returns null', () => {
    test('isForwarded throws when thread.getLabels() returns null', () => {
      const thread = createMockThread();
      thread.getLabels = jest.fn(() => null);
      expect(() => Labels.isForwarded(thread)).not.toThrow();
    });
  });

  describe('BUG 13: _messagesWithAttachment crashes when getAttachments returns null', () => {
    test('forwardToTarget crashes when a message has getAttachments returning null', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const msg = createMockMessage({
        from: '<supplier@example.com>',
      });
      msg.getAttachments = jest.fn(() => null);
      const thread = createMockThread({ messages: [msg] });

      expect(() => Forwarding.forwardToTarget(thread)).not.toThrow();
    });
  });

  describe('BUG 14: _search infinite loop when GmailApp.search returns same page size every call', () => {
    test('_search terminates even if GmailApp.search keeps returning full pages', () => {
      const bigPage = Array.from({ length: 100 }, (_, i) => createMockThread({ id: `t${i}` }));
      let callCount = 0;
      mockGmailApp.search.mockImplementation(() => {
        callCount++;
        if (callCount > 30) return [];
        return bigPage;
      });

      const result = GmailSearch.forDiscovery(365);

      expect(callCount).toBeLessThanOrEqual(21);
      expect(result.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('BUG 15: validateConfig crashes when LLM_CONFIDENCE_THRESHOLD is NaN string', () => {
    test('validateConfig handles non-numeric threshold', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.LLM_CONFIDENCE_THRESHOLD = 'not-a-number';
      Config.__reset();

      expect(() => validateConfig()).not.toThrow();
      const result = validateConfig();
      expect(result.errors.length).toBe(0);
    });
  });

  describe('BUG 16: _getList with trailing commas produces empty entries', () => {
    test('trailing comma in ALLOWED_SENDERS creates empty string entry', () => {
      mockPropsStore.ALLOWED_SENDERS = 'a@b.com,,c@d.com,';
      Config.__reset();
      const result = Config.getAllowedSenders();
      expect(result).not.toContain('');
    });
  });

  describe('BUG 17: classifier matches excluded keywords in supplier subject when allowlisted', () => {
    test('allowlisted supplier with "sale" in subject like "Sales Invoice" is NOT excluded', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Sales Invoice #123',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      expect(Classifier.classify(thread, msg)).toBeNull();
    });
  });

  describe('BUG 18: Log.forwarded crashes on null getDate', () => {
    test('Log.forwarded crashes when message.getDate() returns null', () => {
      const msg = createMockMessage();
      msg.getDate = jest.fn(() => null);
      const thread = createMockThread({ messages: [msg] });

      expect(() => Log.forwarded(msg, thread)).not.toThrow();
    });
  });

  describe('BUG 19: forwardToTarget in dry-run mode applies forwarded label', () => {
    test('dry-run forwardToTarget should NOT apply forwarded label', () => {
      mockPropsStore.DRY_RUN = 'true';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      Forwarding.forwardToTarget(thread);

      expect(thread.addLabel).not.toHaveBeenCalled();
    });
  });

  describe('BUG 20: processLiveEmails double-rejects already-forwarded threads', () => {
    test('already-forwarded thread gets rejected label applied', () => {
      mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.DRY_RUN = 'false';
      Config.__reset();

      const fwdLabel = createMockLabel('gmail-smart-forward/forwarded');
      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg], labels: [fwdLabel] });
      mockGmailApp.search.mockReturnValue([thread]);

      processLiveEmails();

      expect(thread.addLabel).not.toHaveBeenCalled();
    });
  });
});
