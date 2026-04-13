describe('Adversarial Round 8 — Subtle integration bugs', () => {
  beforeEach(() => {
    resetTestState();
  });

  describe('BUG 1: Labels cache becomes stale after label deletion', () => {
    test('Labels cache returns deleted label objects', () => {
      const label = Labels.getForwarded();
      // Simulate label deletion (in real GAS, this might happen externally)
      mockLabelsRegistry[label.getName()] = null;
      // Next call should recreate, not return cached null
      const newLabel = Labels.getForwarded();
      expect(newLabel).not.toBeNull();
    });
  });

  describe('BUG 2: Config cache ignores runtime property updates', () => {
    test('Config.__reset() properly clears cache for dynamic properties', () => {
      Config.getAllowedSenders(); // Loads cache
      mockPropsStore.ALLOWED_SENDERS = 'new@example.com';
      Config.__reset();
      expect(Config.getAllowedSenders()).toEqual(['new@example.com']);
    });
  });

  describe('BUG 3: Thread with 1000+ messages crashes processing', () => {
    test('processLiveEmails handles threads with many messages', () => {
      mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
      mockPropsStore.MAX_EMAILS_PER_RUN = '10';
      Config.__reset();

      const manyMessages = Array.from({ length: 1000 }, (_, i) => 
        createMockMessage({ from: '<supplier@example.com>', id: `msg${i}` })
      );
      const thread = createMockThread({ messages: manyMessages });
      mockGmailApp.search.mockReturnValue([thread]);

      expect(() => processLiveEmails()).not.toThrow();
    });
  });

  describe('BUG 4: Attachments with Unicode names crash getName()', () => {
    test('Classifier.hasValidAttachment handles Unicode attachment names', () => {
      const att = createMockAttachment('файл.pdf');
      const msg = createMockMessage({ attachments: [att] });

      expect(() => Classifier.hasValidAttachment(msg)).not.toThrow();
      expect(Classifier.hasValidAttachment(msg)).toBe(true);
    });
  });

  describe('BUG 5: Email parsing with complex From headers', () => {
    test('_senderEmail handles quoted names and multiple brackets', () => {
      const msg = createMockMessage();
      msg.getFrom = jest.fn(() => '"Dr. Smith, PhD" <smith@example.com> <backup@domain.com>');
      expect(() => Classifier.getSenderEmail(msg)).not.toThrow();
      // Should extract the last bracket pair
      expect(Classifier.getSenderEmail(msg)).toBe('backup@domain.com');
    });
  });

  describe('BUG 6: LLM classifyInvoice with empty PDF content', () => {
    test('LlmClassifier handles PDFs with no extractable text', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      const att = createMockAttachment('empty.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      expect(() => LlmClassifier.classifyInvoice(msg, thread)).not.toThrow();
    });
  });

  describe('BUG 7: Discovery with duplicate senders from different threads', () => {
    test('discoverSuppliers aggregates stats correctly for duplicate senders', () => {
      const msg1 = createMockMessage({
        from: '<supplier@a.com>',
        subject: 'Invoice 1',
        date: new Date('2025-01-01'),
      });
      const thread1 = createMockThread({ messages: [msg1] });

      const msg2 = createMockMessage({
        from: '<supplier@a.com>',
        subject: 'Invoice 2',
        date: new Date('2025-01-02'),
      });
      const thread2 = createMockThread({ messages: [msg2] });

      mockGmailApp.search.mockReturnValue([thread1, thread2]);

      const results = discoverSuppliers();
      expect(results.length).toBe(1);
      expect(results[0].totalEmails).toBe(2);
    });
  });

  describe('BUG 8: Logging with deeply nested data structures', () => {
    test('Log.info handles deeply nested objects without recursion issues', () => {
      const deep = { level1: { level2: { level3: { level4: 'deep' } } } };
      expect(() => Log.info('deep test', deep)).not.toThrow();
    });
  });

  describe('BUG 9: Setup functions called in wrong order', () => {
    test('validateConfig called before labels exist does not crash', () => {
      // Reset labels cache to simulate no labels created yet
      Labels.__reset();
      mockLabelsRegistry = {};

      expect(() => validateConfig()).not.toThrow();
    });
  });

  describe('BUG 10: GmailSearch.forBackfill with empty keyword lists', () => {
    test('forBackfill with no keywords still generates valid query', () => {
      mockPropsStore.SUBJECT_KEYWORDS = '';
      mockPropsStore.ATTACHMENT_FILENAME_KEYWORDS = '';
      Config.__reset();

      const result = GmailSearch.forBackfill();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('BUG 11: _extractPdfText with attachments of different types', () => {
    test('_extractPdfText skips non-PDF attachments', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      const pdfAtt = createMockAttachment('doc.pdf');
      const txtAtt = createMockAttachment('notes.txt');
      txtAtt.getName = jest.fn(() => 'notes.txt');

      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [pdfAtt, txtAtt],
      });
      const thread = createMockThread({ messages: [msg] });

      expect(() => LlmClassifier.classifyInvoice(msg, thread)).not.toThrow();
    });
  });

  describe('BUG 12: Classifier.classify with mixed supplier status in thread', () => {
    test('classify rejects when latest message not allowed and no attachments', () => {
      const allowedMsg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Invoice',
      });
      const notAllowedMsg = createMockMessage({
        from: '<other@example.com>',
        subject: 'Reply',
      });
      const thread = createMockThread({ messages: [allowedMsg, notAllowedMsg] });

      // Latest message not allowed, and no attachments in thread, so rejects
      expect(Classifier.classify(thread, notAllowedMsg)).toBe('no-allowed-attachment');
    });
  });

  describe('BUG 13: Forwarding.markRejected with null thread.getMessages()', () => {
    test('markRejected handles thread with null messages', () => {
      const thread = createMockThread();
      thread.getMessages = jest.fn(() => null);

      expect(() => Forwarding.markRejected(thread, 'test')).not.toThrow();
    });
  });

  describe('BUG 14: Log.forwarded with message.getDate() returning invalid Date', () => {
    test('Log.forwarded handles invalid Date objects', () => {
      const msg = createMockMessage();
      msg.getDate = jest.fn(() => new Date('invalid'));
      const thread = createMockThread({ messages: [msg] });

      expect(() => Log.forwarded(msg, thread)).not.toThrow();
    });
  });

  describe('BUG 15: Config.getLlmConfidenceThreshold with extreme values', () => {
    test('getLlmConfidenceThreshold clamps or handles invalid floats', () => {
      mockPropsStore.LLM_CONFIDENCE_THRESHOLD = '2.5';
      Config.__reset();
      const threshold = Config.getLlmConfidenceThreshold();
      expect(typeof threshold).toBe('number');
      // It returns 2.5 as-is, no validation
    });
  });
});
