describe('Adversarial Round 16 — Iteration 6 invariant confirmation', () => {
  beforeEach(() => {
    resetTestState();
  });

  // ---------------------------------------------------------------------------
  // TEST 1: Invariant — forwardToTarget applies the forwarded label atomically,
  // making classify() return 'already-forwarded' on re-entry.
  // WHY THIS MATTERS: The entire pipeline relies on the forwarded label being
  // applied by forwardToTarget so that subsequent runs (live or backfill) do not
  // re-forward the same thread. If forwardToTarget fails to apply the label, or
  // if Labels.isForwarded does not detect it, every trigger run would re-forward
  // every qualifying thread indefinitely — a data leak multiplier.
  // This test confirms the label-based idempotency gate end-to-end.
  // ---------------------------------------------------------------------------
  describe('TEST 1: Invariant — forwarded label prevents re-forwarding on subsequent classify()', () => {
    test('thread forwarded once is classified as already-forwarded on second pass', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Invoice #42',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      // First pass: classify should approve (null = forward)
      const firstResult = Classifier.classify(thread, msg);
      expect(firstResult).toBeNull();

      // Simulate the forwarding pipeline applying the label
      Forwarding.forwardToTarget(thread);

      // The forwarded label should now be on the thread
      expect(Labels.isForwarded(thread)).toBe(true);

      // Second pass: classify must return 'already-forwarded'
      const secondResult = Classifier.classify(thread, msg);
      expect(secondResult).toBe('already-forwarded');

      // message.forward should have been called exactly once (not twice)
      expect(msg.forward).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Invariant — _getList filters out non-email strings extracted from
  // angle brackets (entries without '@' are discarded).
  // WHY THIS MATTERS: If an admin accidentally pastes a display name or a bare
  // word inside angle brackets into ALLOWED_SENDERS (e.g., "Admin <nocreds>"),
  // the extracted value "nocreds" has no '@' and would match against any sender
  // whose _senderEmail also lacks '@' (e.g., a malformed From header). The
  // config.js _getList function (line 36-37) filters these out by checking for
  // '@'. This test confirms that invariant holds.
  // ---------------------------------------------------------------------------
  describe('TEST 2: Invariant — _getList discards angle-bracket entries without @ sign', () => {
    test('bare word in angle brackets is filtered from allowlist', () => {
      mockPropsStore.ALLOWED_SENDERS = 'Admin <nocreds>, Real <supplier@example.com>';
      Config.__reset();

      const senders = Config.getAllowedSenders();
      // "nocreds" (no @) must be filtered out
      expect(senders).not.toContain('nocreds');
      // The valid email must survive
      expect(senders).toContain('supplier@example.com');
    });

    test('attacker From header without @ does not match filtered allowlist entry', () => {
      mockPropsStore.ALLOWED_SENDERS = 'Broken <admin>';
      Config.__reset();

      // "admin" is extracted but filtered out (no @), so allowlist is empty
      const senders = Config.getAllowedSenders();
      expect(senders).toHaveLength(0);

      // A message with From: admin (no @) must NOT be considered allowed
      const msg = createMockMessage({ from: 'admin' });
      expect(Classifier.isSupplierAllowed(msg)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Invariant — LLM user content is bounded: email body is truncated to
  // 3000 chars and PDF text to PDF_TEXT_LIMIT (3000 chars). This prevents an
  // attacker from sending a very large email body to inflate the LLM prompt
  // token count (causing cost amplification or exceeding context windows).
  // The test verifies the truncation by inspecting what _callApi receives.
  // ---------------------------------------------------------------------------
  describe('TEST 3: Invariant — LLM prompt payload is bounded by body and PDF text limits', () => {
    test('email body longer than 3000 chars is truncated in LLM request', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      // Create a body that is 10,000 chars long
      const longBody = 'A'.repeat(10000);
      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Invoice',
        body: longBody,
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      // Capture the payload sent to UrlFetchApp.fetch
      let capturedPayload = null;
      mockUrlFetchApp.fetch.mockImplementation((_url, options) => {
        capturedPayload = JSON.parse(options.payload);
        return mockHttpResponse;
      });

      // Run classification (result doesn't matter, we inspect the payload)
      Classifier.classify(thread, msg);

      expect(capturedPayload).not.toBeNull();
      const userContent = capturedPayload.messages[1].content;

      // The body portion should be truncated. The full 10,000-char body
      // must NOT appear in the user content.
      expect(userContent).not.toContain('A'.repeat(5000));
      // But the first 3000 chars of the body should be present
      expect(userContent).toContain('A'.repeat(3000));
      // Total content length should be well under 10,000 + overhead
      // (3000 body + up to 3000 PDF + delimiters < 7000)
      expect(userContent.length).toBeLessThan(8000);
    });
  });
});
