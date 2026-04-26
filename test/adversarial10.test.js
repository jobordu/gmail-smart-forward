describe('Adversarial Round 10 — Iteration 6 hardening', () => {
  beforeEach(() => {
    resetTestState();
  });

  // ─── TEST 1: _search pagination stops exactly at maxResults boundary ───
  // When GmailApp.search returns exactly pageSize (100) items per page,
  // and the total hits maxResults exactly (e.g. 200), the while loop
  // condition `results.length < maxResults` must prevent an extra call.
  // If _search made a third call with Math.min(100, 0) = 0, GmailApp.search
  // would receive pageSize=0, which some implementations treat as "no limit".
  describe('TEST 1: _search pagination stops at exact maxResults boundary', () => {
    test('forDiscovery with exactly 200 results across 2 full pages does not make a third call', () => {
      const page1 = Array.from({ length: 100 }, (_, i) => createMockThread({ id: `t${i}` }));
      const page2 = Array.from({ length: 100 }, (_, i) => createMockThread({ id: `t${i + 100}` }));

      mockGmailApp.search
        .mockReturnValueOnce(page1)
        .mockReturnValueOnce(page2);

      // forDiscovery has maxResults=2000, so we need to use forLive which
      // uses Config.getMaxEmailsPerRun(). Set it to 200 for this test.
      mockPropsStore.MAX_EMAILS_PER_RUN = '200';
      mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
      Config.__reset();

      const result = GmailSearch.forLive(20);

      expect(result).toHaveLength(200);
      // Exactly 2 calls, NOT 3. A third call with pageSize=0 would be a bug.
      expect(mockGmailApp.search).toHaveBeenCalledTimes(2);
    });
  });

  // ─── TEST 2: processLiveEmails skips threads with empty messages without
  //     consuming budget ─────────────────────────────────────────────────────
  // live.js line 26: `if (!messages || messages.length === 0) continue;`
  // This skip must NOT increment `processed`, otherwise it consumes budget
  // and starves legitimate threads. Verify the thread after the empty one
  // still gets processed.
  describe('TEST 2: processLiveEmails skips empty-message threads without budget cost', () => {
    test('thread with empty messages array does not consume processed budget', () => {
      mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.MAX_EMAILS_PER_RUN = '1';
      Config.__reset();

      // First thread has empty messages — should be skipped without budget cost
      const emptyThread = createMockThread({ id: 'empty-thread' });
      emptyThread.getMessages = jest.fn(() => []);

      // Second thread is legitimate and should be forwarded
      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const goodThread = createMockThread({ id: 'good-thread', messages: [msg] });

      mockGmailApp.search.mockReturnValue([emptyThread, goodThread]);

      processLiveEmails();

      // The good thread should still be forwarded despite MAX_EMAILS_PER_RUN=1
      // because the empty thread should not have consumed the budget.
      expect(msg.forward).toHaveBeenCalledWith('test@target.com');
    });
  });

  // ─── TEST 3: _extractPdfTextFromRawBytes falls through when getDataAsString
  //     throws an exception ──────────────────────────────────────────────────
  // The catch block in _extractPdfTextFromRawBytes should return null,
  // causing _extractPdfText to fall through to tier 3 (metadata fallback).
  // This tests the error-handling path that is otherwise never exercised.
  describe('TEST 3: _extractPdfTextFromRawBytes error path falls to tier 3', () => {
    test('classifyInvoice uses metadata fallback when getDataAsString throws', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      // Tier 1 skipped (content type is application/pdf, not google doc)
      mockDocBody.getText.mockReturnValue('');
      mockDriveApp.createFile.mockReturnValue({
        getId: jest.fn(() => 'doc-id'),
        setTrashed: jest.fn(),
      });

      // Create attachment whose copyBlob().getDataAsString() throws
      const att = createMockAttachment('invoice.pdf');
      const blob = att.copyBlob();
      blob.getDataAsString = jest.fn(() => {
        throw new Error('Encoding error: invalid byte sequence');
      });
      att.copyBlob = jest.fn(() => blob);

      const msg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Invoice',
        body: 'See attached',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      // Should not throw — should fall through to tier 3 metadata
      expect(() => LlmClassifier.classifyInvoice(msg, thread)).not.toThrow();

      // Verify the API was called with metadata fallback content
      const fetchCall = mockUrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;
      expect(userContent).toContain('PDF metadata');
      expect(userContent).toContain('invoice.pdf');
    });
  });

  // ─── TEST 4: _extractPdfTextFromRawBytes with odd-length hex string ────
  // The hex decoder loop uses `k + 1 < hex.length` with `k += 2`.
  // An odd-length hex string like "4F6E65" (3 bytes = 6 hex chars) works fine.
  // But "4F6E6" (5 hex chars = odd) silently drops the last nibble.
  // If the resulting decoded text still has 3+ alpha chars, it's included.
  // Verify the parser doesn't crash and handles truncation gracefully.
  describe('TEST 4: _extractPdfTextFromRawBytes with odd-length hex', () => {
    test('odd-length hex string is truncated but does not crash', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('');
      mockDriveApp.createFile.mockReturnValue({
        getId: jest.fn(() => 'doc-id'),
        setTrashed: jest.fn(),
      });

      // "Invoice" in hex is 496E766F696365 (14 chars, even).
      // Make it odd by appending one nibble: 496E766F6963654 (15 chars).
      // The decoder will process 7 complete bytes (496E766F696365 = "Invoice")
      // and skip the trailing "4". The decoded text "Invoice" has 7 alpha chars,
      // passing the /[a-zA-Z]{3,}/ filter.
      var oddHex = '496E766F6963654'; // "Invoice" + trailing nibble
      var pdfRaw = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n' +
        '2 0 obj\n<< /Length 20 >>\nstream\n<' + oddHex + '>\nendstream\nendobj\n' +
        'xref\n0 3\ntrailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF';
      var pdfContent = Buffer.from(pdfRaw);

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      var pdfAtt = createMockAttachment('invoice.pdf', pdfContent);
      var msg = createMockMessage({
        subject: 'Invoice',
        body: 'Pay now',
        attachments: [pdfAtt],
      });
      var thread = createMockThread({ messages: [msg] });

      // Should not throw
      expect(() => LlmClassifier.classifyInvoice(msg, thread)).not.toThrow();

      // The content sent to the LLM should contain "Invoice" from the hex
      // (not crash or produce garbage from the odd-length string)
      var fetchCall = mockUrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      var userContent = payload.messages[1].content;
      expect(userContent).toContain('Invoice');
    });
  });

  // ─── TEST 5: _runBackfill skips empty-message threads without budget cost ──
  // Same pattern as TEST 2 but for backfill. _runBackfill line 98:
  // `if (!messages || messages.length === 0) continue;`
  // This skip must not increment `processed`, preserving budget for real threads.
  describe('TEST 5: _runBackfill skips empty-message threads without budget cost', () => {
    test('backfillApprovedSuppliers processes valid thread after empty-message thread', () => {
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.MAX_EMAILS_PER_RUN = '1';
      Config.__reset();

      // First thread has null messages
      const nullMsgThread = createMockThread({ id: 'null-thread' });
      nullMsgThread.getMessages = jest.fn(() => null);

      // Second thread is legitimate
      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const goodThread = createMockThread({ id: 'good-thread', messages: [msg] });

      mockGmailApp.search.mockReturnValue([nullMsgThread, goodThread]);

      // Mock _shuffle to be a no-op (preserve order)
      const origRandom = Math.random;
      Math.random = () => 0;

      try {
        backfillApprovedSuppliers();
      } finally {
        Math.random = origRandom;
      }

      // The good thread should still be forwarded despite MAX_EMAILS_PER_RUN=1
      expect(msg.forward).toHaveBeenCalledWith('test@target.com');
    });
  });
});
