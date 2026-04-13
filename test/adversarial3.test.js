describe('Adversarial Round 3 — New bugs', () => {
  beforeEach(() => {
    resetTestState();
  });

  describe('BUG 1: _containsKeyword crashes on null text', () => {
    test('isExcludedMessage crashes when getSubject() returns null', () => {
      const msg = createMockMessage({ subject: 'Hello' });
      msg.getSubject = jest.fn(() => null);
      expect(() => Classifier.isExcludedMessage(msg)).toThrow(TypeError);
    });

    test('isForwardableReceipt crashes when getSubject() returns null', () => {
      const msg = createMockMessage({ subject: 'Hello' });
      msg.getSubject = jest.fn(() => null);
      expect(() => Classifier.isForwardableReceipt(msg)).toThrow(TypeError);
    });

    test('isExcludedMessage crashes when getPlainBody() returns null', () => {
      const msg = createMockMessage({ body: 'body' });
      msg.getPlainBody = jest.fn(() => null);
      expect(() => Classifier.isExcludedMessage(msg)).toThrow(TypeError);
    });
  });

  describe('BUG 2: _senderEmail crashes on null from', () => {
    test('getSenderEmail crashes when getFrom() returns null', () => {
      const msg = createMockMessage();
      msg.getFrom = jest.fn(() => null);
      expect(() => Classifier.getSenderEmail(msg)).toThrow(TypeError);
    });
  });

  describe('BUG 3: LLM _buildUserContent crashes on null body', () => {
    test('classifyInvoice crashes when getPlainBody() returns null', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
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

  describe('BUG 4: _search pagination caps results correctly (confirmed NOT a bug)', () => {
    test('_search never exceeds maxResults even with multiple large pages', () => {
      const page1 = Array.from({ length: 95 }, (_, i) => createMockThread({ id: `a${i}` }));
      const page2 = Array.from({ length: 100 }, (_, i) => createMockThread({ id: `b${i}` }));
      mockGmailApp.search
        .mockReturnValueOnce(page1)
        .mockReturnValueOnce(page2);

      const result = GmailSearch.forDiscovery(365);

      expect(result.length).toBeLessThanOrEqual(2000);
      expect(result.length).toBe(95);
    });
  });

  describe('BUG 5: Log.forwarded/rejected handle null getDate gracefully (FIXED)', () => {
    test('Log.forwarded does not crash when message.getDate() returns null', () => {
      const msg = createMockMessage();
      msg.getDate = jest.fn(() => null);
      const thread = createMockThread({ messages: [msg] });

      const entry = Log.forwarded(msg, thread);
      expect(entry.date).toBeNull();
    });

    test('Log.rejected does not crash when message.getDate() returns null', () => {
      const msg = createMockMessage();
      msg.getDate = jest.fn(() => null);
      const thread = createMockThread({ messages: [msg] });

      const entry = Log.rejected(msg, thread, 'test');
      expect(entry.date).toBeNull();
    });
  });

  describe('BUG 6: Discovery crashes on null getDate', () => {
    test('discoverSuppliers crashes when message.getDate() returns null', () => {
      const msg = createMockMessage({
        from: '<supplier@a.com>',
        subject: 'Invoice',
      });
      msg.getDate = jest.fn(() => null);

      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      expect(() => discoverSuppliers()).toThrow(TypeError);
    });
  });

  describe('BUG 7: classify/forwardToTarget mismatch — thread stuck in infinite re-evaluation', () => {
    test('classify returns null but forwardToTarget forwards nothing — thread never labeled', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
      mockPropsStore.DRY_RUN = 'false';
      Config.__reset();

      const randomAtt = createMockAttachment('invoice.pdf');
      const randomMsg = createMockMessage({
        from: '<random@other.com>',
        attachments: [randomAtt],
      });
      const supplierMsg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Invoice discussion',
        attachments: [],
      });
      const thread = createMockThread({ messages: [randomMsg, supplierMsg] });

      expect(Classifier.classify(thread, supplierMsg)).toBeNull();

      Forwarding.forwardToTarget(thread);

      const fwdLabel = mockLabelsRegistry['gmail-smart-forward/forwarded'];
      expect(thread.addLabel).not.toHaveBeenCalledWith(fwdLabel);
      expect(randomMsg.forward).not.toHaveBeenCalled();
    });
  });

  describe('BUG 8: forBackfill generates query exceeding reasonable length', () => {
    test('default 100+ keywords produce query over 2000 chars', () => {
      mockGmailApp.search.mockReturnValue([]);

      GmailSearch.forBackfill(null);

      const query = mockGmailApp.search.mock.calls[0][0];
      expect(query.length).toBeGreaterThan(2000);
    });
  });

  describe('BUG 9: _getList handles empty angle bracket input (FIXED)', () => {
    test('_getList: input "<>" produces no entries (empty email filtered out)', () => {
      mockPropsStore.ALLOWED_SENDERS = '<>';
      Config.__reset();
      const result = Config.getAllowedSenders();
      expect(result).toEqual([]);
    });
  });

  describe('BUG 10: LLM _callApi sends "Bearer null" when API key is missing', () => {
    test('_callApi does not send fetch when API key is not set (fail-open)', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      delete mockPropsStore.LLM_API_KEY;
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      expect(() => Classifier.classify(thread, msg)).not.toThrow();
      expect(mockUrlFetchApp.fetch).not.toHaveBeenCalled();
    });
  });

  describe('BUG 11: _runBackfill passes null to _shuffle when forBackfill returns null', () => {
    test('backfillApprovedSuppliers handles null search results gracefully', () => {
      mockGmailApp.search.mockReturnValue(null);
      expect(() => backfillApprovedSuppliers()).not.toThrow();
    });

    test('backfillApprovedSuppliers handles empty array from forBackfill', () => {
      mockGmailApp.search.mockReturnValue([]);
      expect(() => backfillApprovedSuppliers()).not.toThrow();
    });
  });

  describe('BUG 12: classify passes wrong message to LLM for daisy-chain threads', () => {
    test('LLM receives the allowlisted sender message, not the latest forwarded message', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const supplierMsg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Invoice from supplier',
        body: 'Original invoice body',
        attachments: [att],
      });
      const fwdMsg = createMockMessage({
        from: '<colleague@company.com>',
        subject: 'Fwd: Check this out — sale discount!',
        body: 'Hey this is a great marketing deal, check the promotion!',
      });
      const thread = createMockThread({ messages: [supplierMsg, fwdMsg] });

      Classifier.classify(thread, fwdMsg);

      const fetchCall = mockUrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;

      expect(userContent).toContain('Invoice from supplier');
      expect(userContent).not.toContain('marketing deal');
    });
  });
});
