describe('Adversarial Round 11 — Iteration 2 hardening', () => {
  beforeEach(() => {
    resetTestState();
  });

  // ─── TEST 1: clearAllLabels actually calls removeLabel on each thread ──────
  // setup-module.test.js only asserts that getThreads was called, but never
  // verifies that removeLabel is invoked on each thread. If removeLabel
  // were accidentally removed from the loop body, no test would catch it.
  describe('TEST 1: clearAllLabels calls removeLabel on every thread for all label types', () => {
    test('removeLabel is called for each thread in each label category', () => {
      // Create threads with the forwarded label attached
      const fwdThread1 = createMockThread({ id: 'fwd-1' });
      const fwdThread2 = createMockThread({ id: 'fwd-2' });

      // Set up labels with threads
      const fwdLabel = Labels.getForwarded();
      fwdLabel.getThreads = jest.fn(() => [fwdThread1, fwdThread2]);

      const rejLabel = Labels.getRejected();
      const rejThread = createMockThread({ id: 'rej-1' });
      rejLabel.getThreads = jest.fn(() => [rejThread]);

      // Candidate and Discovered have no threads
      const candLabel = Labels.getCandidate();
      candLabel.getThreads = jest.fn(() => []);
      const discLabel = Labels.getDiscovered();
      discLabel.getThreads = jest.fn(() => []);

      clearAllLabels();

      // Verify removeLabel was called on each thread with the correct label
      expect(fwdThread1.removeLabel).toHaveBeenCalledWith(fwdLabel);
      expect(fwdThread2.removeLabel).toHaveBeenCalledWith(fwdLabel);
      expect(rejThread.removeLabel).toHaveBeenCalledWith(rejLabel);
    });
  });

  // ─── TEST 2: validateConfig detects non-email FORWARD_TO_EMAIL ─────────────
  // setup.js line 79: `if (email && !/@/.test(email))` produces an error when
  // FORWARD_TO_EMAIL is set to a value without an @ sign. This path is tested
  // in validate-env.test.js via the build script, but never via the actual
  // validateConfig() function call in the unit test suite.
  describe('TEST 2: validateConfig reports error for FORWARD_TO_EMAIL without @', () => {
    test('FORWARD_TO_EMAIL set to "not-an-email" produces validation error', () => {
      mockPropsStore.FORWARD_TO_EMAIL = 'not-an-email';
      Config.__reset();

      const result = validateConfig();

      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('does not look like a valid email'),
        ])
      );
    });
  });

  // ─── TEST 3: _extractPdfText finds PDF in second message when first has none ─
  // llm.js _extractPdfText iterates all messages in a thread looking for the
  // first .pdf attachment. If the first message has no attachments and the
  // second message has a PDF, it should still find and extract text from it.
  // Existing tests only verify single-message threads or threads where the
  // first message already has the PDF.
  describe('TEST 3: LLM _extractPdfText finds PDF in second message of thread', () => {
    test('classifyInvoice extracts PDF from second message when first has no PDF', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      // First message: no attachments
      const msg1 = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Initial inquiry',
        body: 'Please see next email for invoice',
        attachments: [],
      });

      // Second message: has a PDF with extractable text
      const pdfContent = buildRealisticPdfContent([
        { text: 'Invoice Number INV-2025-0099 Amount Due EUR 500.00' },
      ]);
      const pdfAtt = createMockAttachment('invoice.pdf', pdfContent);
      const msg2 = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Your Invoice',
        body: 'Invoice attached',
        attachments: [pdfAtt],
      });

      const thread = createMockThread({ messages: [msg1, msg2] });

      // Should not throw and should call the LLM API
      LlmClassifier.classifyInvoice(msg2, thread);

      expect(mockUrlFetchApp.fetch).toHaveBeenCalled();
      const fetchCall = mockUrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;
      // The PDF text should have been extracted from the second message's PDF
      expect(userContent).toContain('Invoice Number');
    });
  });

  // ─── TEST 4: processLiveEmails with LLM fail-open does not block forwarding
  //     even when LLM throws during classification ───────────────────────────
  // classifier.js line 147-149: the catch block logs the error and returns null
  // (should forward). This end-to-end path through processLiveEmails where the
  // LLM throws but the email is still forwarded has never been tested as a
  // full integration flow.
  describe('TEST 4: processLiveEmails forwards email when LLM throws (fail-open)', () => {
    test('email is forwarded despite LLM API failure', () => {
      mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      // Make the LLM API throw a network error
      mockUrlFetchApp.fetch.mockImplementation(() => {
        throw new Error('Connection timeout');
      });

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Your Invoice #123',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      processLiveEmails();

      // Despite LLM failure, the email should be forwarded (fail-open)
      expect(msg.forward).toHaveBeenCalledWith('test@target.com');
    });
  });
});
