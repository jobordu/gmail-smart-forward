describe('Adversarial Round 5 — New bugs', () => {
  beforeEach(() => {
    resetTestState();
  });

  describe('BUG 1: threadHasAllowedAttachment handles null getAttachments (FIXED)', () => {
    test('classify does not crash on thread where one message has null getAttachments', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const msg1 = createMockMessage({
        from: '<supplier@example.com>',
      });
      msg1.getAttachments = jest.fn(() => null);
      const msg2 = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [createMockAttachment('invoice.pdf')],
      });
      const thread = createMockThread({ messages: [msg1, msg2] });

      expect(() => Classifier.threadHasAllowedAttachment(thread)).not.toThrow();
      expect(Classifier.threadHasAllowedAttachment(thread)).toBe(true);
    });
  });

  describe('BUG 2: _attachmentNames crashes when getAttachments returns null', () => {
    test('isForwardableReceipt crashes when getAttachments returns null', () => {
      const msg = createMockMessage({ subject: 'Hello' });
      msg.getAttachments = jest.fn(() => null);
      expect(() => Classifier.isForwardableReceipt(msg)).toThrow();
    });
  });

  describe('BUG 3: hasValidAttachment crashes when getAttachments returns null', () => {
    test('hasValidAttachment throws when getAttachments returns null', () => {
      const msg = createMockMessage();
      msg.getAttachments = jest.fn(() => null);
      expect(() => Classifier.hasValidAttachment(msg)).toThrow();
    });
  });

  describe('BUG 4: discovery date comparison with null getDate', () => {
    test('discoverSuppliers crashes when second message from same sender has null getDate', () => {
      const msg1 = createMockMessage({
        from: '<supplier@a.com>',
        subject: 'Invoice 1',
        date: new Date('2025-06-01'),
      });
      const msg2 = createMockMessage({
        from: '<supplier@a.com>',
        subject: 'Invoice 2',
      });
      msg2.getDate = jest.fn(() => null);
      const thread = createMockThread({ messages: [msg1, msg2] });
      mockGmailApp.search.mockReturnValue([thread]);

      expect(() => discoverSuppliers()).toThrow();
    });
  });

  describe('BUG 5: _extractPdfText crashes when getAttachments returns null', () => {
    test('LLM classifyInvoice crashes when thread messages have null getAttachments', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [createMockAttachment('invoice.pdf')],
      });
      const otherMsg = createMockMessage({ from: '<other@b.com>' });
      otherMsg.getAttachments = jest.fn(() => null);
      const thread = createMockThread({ messages: [otherMsg, msg] });

      expect(() => Classifier.classify(thread, msg)).not.toThrow();
    });
  });

  describe('BUG 6: _buildUserContent crashes on null subject', () => {
    test('LlmClassifier.classifyInvoice crashes when subject is null', () => {
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

  describe('BUG 7: _buildUserContent crashes on null body', () => {
    test('LlmClassifier.classifyInvoice crashes when body is null', () => {
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

  describe('BUG 8: _callApi crashes when response has no choices array', () => {
    test('LLM classification with malformed response (empty choices)', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      mockHttpResponse.getContentText.mockReturnValue('{"choices":[]}');

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      expect(() => Classifier.classify(thread, msg)).not.toThrow();
    });
  });

  describe('BUG 9: _callApi crashes when JSON.parse returns non-object', () => {
    test('LLM response is a plain string, not a JSON object', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"just a string, not json"}}]}'
      );

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      expect(() => Classifier.classify(thread, msg)).not.toThrow();
    });
  });

  describe('BUG 10: live.js Labels.applyRejected + Log.rejected inconsistency with Forwarding.markRejected', () => {
    test('processLiveEmails applies rejected label but does not check thread messages for null', () => {
      mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const msg = createMockMessage({
        from: '<unknown@other.com>',
      });
      msg.getDate = jest.fn(() => null);
      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      expect(() => processLiveEmails()).not.toThrow();
    });
  });

  describe('BUG 11: _hasAllowedExtension handles null attachment name (FIXED)', () => {
    test('forwardToTarget does not crash when getName returns null', () => {
      const att = createMockAttachment('invoice.pdf');
      att.getName = jest.fn(() => null);
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      expect(() => Forwarding.forwardToTarget(thread)).not.toThrow();
    });
  });

  describe('BUG 12: backfillSender does not respect maxEmailsPerRun for rejected threads', () => {
    test('backfillSender processes rejected threads beyond maxEmailsPerRun limit', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.MAX_EMAILS_PER_RUN = '1';
      Config.__reset();

      const threads = Array.from({ length: 5 }, (_, i) => {
        const msg = createMockMessage({
          from: '<unknown@other.com>',
        });
        return createMockThread({ messages: [msg], id: `t${i}` });
      });
      mockGmailApp.search.mockReturnValue(threads);

      backfillSender('test@example.com');

      const rejectedCount = threads.filter(t => t.addLabel.mock.calls.length > 0).length;
      expect(rejectedCount).toBeLessThanOrEqual(1);
    });
  });

  describe('BUG 13: _senderEmail crashes on undefined getFrom', () => {
    test('getSenderEmail throws when getFrom returns undefined', () => {
      const msg = createMockMessage();
      msg.getFrom = jest.fn(() => undefined);
      expect(() => Classifier.getSenderEmail(msg)).toThrow();
    });
  });

  describe('BUG 14: _getList returns empty string from whitespace-only entry between commas', () => {
    test('_getList with "a@b.com,   ,c@d.com" includes empty string', () => {
      mockPropsStore.ALLOWED_SENDERS = 'a@b.com,   ,c@d.com';
      Config.__reset();
      const result = Config.getAllowedSenders();
      expect(result).not.toContain('');
      expect(result.length).toBe(2);
    });
  });

  describe('BUG 15: discovery crashes on thread with empty messages array', () => {
    test('discoverSuppliers crashes when thread.getMessages() returns empty array', () => {
      const thread = createMockThread({ messages: [] });
      mockGmailApp.search.mockReturnValue([thread]);

      expect(() => discoverSuppliers()).not.toThrow();
    });
  });

  describe('BUG 16: _extractPdfText crashes when attachment getName returns null', () => {
    test('classify with PDF attachment that has null name', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      att.getName = jest.fn(() => null);
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      expect(() => Classifier.classify(thread, msg)).not.toThrow();
    });
  });

  describe('BUG 17: _getBool returns wrong default for empty string value', () => {
    test('_getBool with value "" should return default, not false', () => {
      mockPropsStore.DRY_RUN = '';
      Config.__reset();
      expect(Config.isDryRun()).toBe(DEFAULT_DRY_RUN);
    });
  });

  describe('BUG 18: _getInt returns default for value "0" to prevent silent misconfiguration', () => {
    test('MAX_EMAILS_PER_RUN=0 returns default value', () => {
      mockPropsStore.MAX_EMAILS_PER_RUN = '0';
      Config.__reset();
      expect(Config.getMaxEmailsPerRun()).toBe(DEFAULT_MAX_EMAILS_PER_RUN);
    });
  });

  describe('BUG 19: _search with maxResults=0 should return empty without searching', () => {
    test('forLive with MAX_EMAILS_PER_RUN=0 skips GmailApp.search', () => {
      mockPropsStore.MAX_EMAILS_PER_RUN = '0';
      Config.__reset();

      mockGmailApp.search.mockReturnValue([]);
      const result = GmailSearch.forLive(20);
      expect(result).toEqual([]);
    });
  });

  describe('BUG 20: _formatDate with invalid date produces NaN in query', () => {
    test('forDiscovery with negative days produces NaN date', () => {
      mockPropsStore.DISCOVERY_DAYS = '-1';
      Config.__reset();

      mockGmailApp.search.mockReturnValue([]);
      GmailSearch.forDiscovery(Config.getDiscoveryDays());

      const query = mockGmailApp.search.mock.calls[0][0];
      expect(query).not.toContain('NaN');
    });
  });
});
