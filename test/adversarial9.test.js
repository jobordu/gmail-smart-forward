describe('Adversarial Round 9 — Iteration 5 hardening', () => {
  beforeEach(() => {
    resetTestState();
  });

  // ─── BUG 1: status() crashes when getProjectTriggers returns null ───
  // setupTrigger and removeTrigger both have null guards for
  // getProjectTriggers(), but status() does NOT. It directly does
  // `triggers.length` which throws TypeError on null.
  describe('status() handles null from getProjectTriggers', () => {
    test('status does not crash when getProjectTriggers returns null', () => {
      const original = global.ScriptApp;
      global.ScriptApp = { ...original, getProjectTriggers: jest.fn(() => null) };

      try {
        expect(() => status()).not.toThrow();
      } finally {
        global.ScriptApp = original;
      }
    });
  });

  // ─── BUG 2: clearAllLabels crashes when getThreads returns null ─────
  // clearAllLabels calls entry.label.getThreads() then .forEach() on it.
  // If getThreads returns null (e.g. API error), .forEach() on null throws.
  describe('clearAllLabels handles null from getThreads', () => {
    test('clearAllLabels does not crash when a label getThreads returns null', () => {
      // Create labels first
      Labels.setup();
      // Sabotage one label's getThreads to return null
      const fwdLabel = Labels.getForwarded();
      fwdLabel.getThreads = jest.fn(() => null);

      expect(() => clearAllLabels()).not.toThrow();
    });
  });

  // ─── BUG 3: validateConfig does not detect LLM_CONFIDENCE_THRESHOLD
  //     that is NaN from a garbage string, because getLlmConfidenceThreshold
  //     returns 0.7 (the default) for NaN. So threshold = 0.7 passes the
  //     0..1 range check. This means garbage threshold values are silently
  //     accepted with no warning.
  describe('validateConfig warns on garbage LLM threshold', () => {
    test('validateConfig warns when LLM_CONFIDENCE_THRESHOLD is garbage', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.LLM_CONFIDENCE_THRESHOLD = 'not-a-number';
      Config.__reset();

      const result = validateConfig();
      // The garbage value silently becomes 0.7 (default).
      // validateConfig should at least warn that the configured value was
      // not a valid number, but it doesn't — it only checks the parsed result.
      // This test checks whether the user gets ANY feedback about the bad config.
      const allMessages = result.errors.concat(result.warnings);
      const mentionsThreshold = allMessages.some(m =>
        m.toLowerCase().includes('threshold') || m.toLowerCase().includes('confidence')
      );
      expect(mentionsThreshold).toBe(true);
    });
  });

  // ─── BUG 4: LLM API returns response with no choices key at all ─────
  // If the API returns {"error": "rate limited"} with 200 status code
  // (some providers do this), body.choices is undefined, and
  // body.choices[0] throws TypeError. classify() catches it (fail-open).
  // But the error message is unhelpful — "Cannot read properties of
  // undefined (reading '0')" rather than something actionable.
  describe('LLM API returns 200 with no choices key', () => {
    test('classifyInvoice throws on response missing choices key entirely', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      mockHttpResponse.getContentText.mockReturnValue(
        '{"error":{"message":"rate limited","type":"rate_limit_error"}}'
      );

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      // classifyInvoice throws on malformed responses — that's by design.
      // The caller (classify) catches it for fail-open behavior.
      expect(() => LlmClassifier.classifyInvoice(msg, thread)).toThrow();
      const result = Classifier.classify(thread, msg);
      expect(result).toBeNull(); // fail-open
    });
  });

  // ─── BUG 5: backfillSender with undefined senderEmail ───────────────
  // backfillSender checks `if (!senderEmail)` which catches null and
  // undefined, but what about empty string ''? An empty string is falsy
  // so it should early-return. But what about a whitespace-only string?
  // ' ' is truthy, so it would construct query 'from: ' which is invalid.
  describe('backfillSender rejects whitespace-only sender', () => {
    test('backfillSender with whitespace-only string is rejected by guard', () => {
      mockGmailApp.search.mockReturnValue([]);

      backfillSender('   ');

      // Whitespace-only input should be rejected — no search should occur
      expect(mockGmailApp.search).not.toHaveBeenCalled();
    });
  });
});
