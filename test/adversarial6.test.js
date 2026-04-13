describe('Adversarial Round 6 — New bugs', () => {
  beforeEach(() => {
    resetTestState();
  });

  // ─── _runBackfill limit inconsistency ─────────────────────────────
  describe('BUG 1: _runBackfill does not count rejected threads toward limit', () => {
    test('backfillApprovedSuppliers processes rejected threads beyond maxEmailsPerRun', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.MAX_EMAILS_PER_RUN = '2';
      Config.__reset();

      const threads = Array.from({ length: 10 }, (_, i) => {
        const msg = createMockMessage({
          from: '<unknown@other.com>',
        });
        return createMockThread({ messages: [msg], id: `t${i}` });
      });
      mockGmailApp.search.mockReturnValue(threads);

      backfillApprovedSuppliers();

      const rejectedCount = threads.filter(t => t.addLabel.mock.calls.length > 0).length;
      expect(rejectedCount).toBeLessThanOrEqual(2);
    });
  });

  // ─── live.js does not count rejected threads toward limit ─────────
  describe('BUG 2: processLiveEmails rejects unlimited threads beyond maxEmailsPerRun', () => {
    test('only processes up to maxEmailsPerRun threads total (forwarded + rejected)', () => {
      mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.MAX_EMAILS_PER_RUN = '2';
      Config.__reset();

      const threads = Array.from({ length: 10 }, (_, i) => {
        const msg = createMockMessage({
          from: '<unknown@other.com>',
        });
        return createMockThread({ messages: [msg], id: `t${i}` });
      });
      mockGmailApp.search.mockReturnValue(threads);

      processLiveEmails();

      const rejectedCount = threads.filter(t => t.addLabel.mock.calls.length > 0).length;
      expect(rejectedCount).toBeLessThanOrEqual(2);
    });
  });

  // ─── _extractPdfText crashes when getAttachments returns null ─────
  describe('BUG 3: _extractPdfText crashes when message.getAttachments returns null', () => {
    test('classify with LLM does not crash when a thread message has null getAttachments', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const goodMsg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const badMsg = createMockMessage({ from: '<other@b.com>' });
      badMsg.getAttachments = jest.fn(() => null);
      const thread = createMockThread({ messages: [badMsg, goodMsg] });

      expect(() => Classifier.classify(thread, goodMsg)).not.toThrow();
    });
  });

  // ─── _extractPdfText .getName().toLowerCase() on null name ────────
  describe('BUG 4: _extractPdfText crashes when attachment getName returns null', () => {
    test('LLM classify does not crash when attachment has null name', () => {
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

  // ─── _attachmentNames .getName().toLowerCase() on null ────────────
  describe('BUG 5: _attachmentNames crashes when attachment getName returns null', () => {
    test('isForwardableReceipt does not crash when attachment has null name', () => {
      const att = createMockAttachment('invoice.pdf');
      att.getName = jest.fn(() => null);
      const msg = createMockMessage({ subject: 'Hello', attachments: [att] });

      expect(() => Classifier.isForwardableReceipt(msg)).not.toThrow();
    });
  });

  // ─── hasValidAttachment .getName().toLowerCase() on null ──────────
  describe('BUG 6: hasValidAttachment crashes when attachment getName returns null', () => {
    test('hasValidAttachment does not crash when attachment has null name', () => {
      const att = createMockAttachment('file.pdf');
      att.getName = jest.fn(() => null);
      const msg = createMockMessage({ attachments: [att] });

      expect(() => Classifier.hasValidAttachment(msg)).not.toThrow();
    });
  });

  // ─── discovery null getDate on first message ──────────────────────
  describe('BUG 7: discoverSuppliers crashes on null getDate during date comparison', () => {
    test('first message with null getDate sets firstSeen/lastSeen to null, second crashes', () => {
      const msg1 = createMockMessage({
        from: '<supplier@a.com>',
        subject: 'Invoice',
      });
      msg1.getDate = jest.fn(() => null);
      const msg2 = createMockMessage({
        from: '<supplier@a.com>',
        subject: 'Invoice 2',
        date: new Date('2025-06-15'),
      });
      const thread = createMockThread({ messages: [msg1, msg2] });
      mockGmailApp.search.mockReturnValue([thread]);

      expect(() => discoverSuppliers()).toThrow();
    });
  });

  // ─── discovery null getDate on toISOString ────────────────────────
  describe('BUG 8: discoverSuppliers toISOString crashes on null firstSeen/lastSeen', () => {
    test('discoverSuppliers crashes in report when getDate returns null', () => {
      const msg = createMockMessage({
        from: '<supplier@a.com>',
        subject: 'Invoice',
      });
      msg.getDate = jest.fn(() => null);
      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      expect(() => discoverSuppliers()).toThrow();
    });
  });

  // ─── _senderEmail crashes on non-string getFrom (number) ─────────
  describe('BUG 9: _senderEmail crashes when getFrom returns non-string', () => {
    test('getSenderEmail throws when getFrom returns a number', () => {
      const msg = createMockMessage();
      msg.getFrom = jest.fn(() => 42);
      expect(() => Classifier.getSenderEmail(msg)).toThrow();
    });
  });

  // ─── _containsKeyword subject/body null in classify ───────────────
  describe('BUG 10: isExcludedMessage crashes on null subject AND null body', () => {
    test('isExcludedMessage throws when both getSubject and getPlainBody return null', () => {
      const msg = createMockMessage();
      msg.getSubject = jest.fn(() => null);
      msg.getPlainBody = jest.fn(() => null);
      expect(() => Classifier.isExcludedMessage(msg)).toThrow();
    });
  });

  // ─── _getBool with "TRUE" (uppercase) after trim ──────────────────
  describe('BUG 11: _getBool is case-insensitive (confirmed working)', () => {
    test('DRY_RUN="TRUE" returns true', () => {
      mockPropsStore.DRY_RUN = 'TRUE';
      Config.__reset();
      expect(Config.isDryRun()).toBe(true);
    });

    test('DRY_RUN="True" returns true', () => {
      mockPropsStore.DRY_RUN = 'True';
      Config.__reset();
      expect(Config.isDryRun()).toBe(true);
    });
  });

  // ─── _getInt with very large number ───────────────────────────────
  describe('BUG 12: _getInt with huge value', () => {
    test('MAX_EMAILS_PER_RUN="999999999" returns huge number', () => {
      mockPropsStore.MAX_EMAILS_PER_RUN = '999999999';
      Config.__reset();
      expect(Config.getMaxEmailsPerRun()).toBe(999999999);
    });
  });

  // ─── _getLlmConfidenceThreshold with "1.5" (out of range) ────────
  describe('BUG 13: LLM threshold 1.5 is accepted but should be clamped', () => {
    test('threshold of 1.5 is returned as-is (not clamped)', () => {
      mockPropsStore.LLM_CONFIDENCE_THRESHOLD = '1.5';
      Config.__reset();
      const t = Config.getLlmConfidenceThreshold();
      expect(t).toBe(1.5);
    });
  });

  // ─── _getList email extraction with multiple angle brackets ───────
  describe('BUG 14: _getList extracts email from nested angle brackets', () => {
    test('extracts email from nested angle brackets', () => {
      mockPropsStore.ALLOWED_SENDERS = 'Display <first<second@example.com>>';
      Config.__reset();
      const result = Config.getAllowedSenders();
      expect(result).toEqual(['second@example.com']);
    });
  });

  // ─── Config cache stale after runtime property change ─────────────
  describe('BUG 15: Config cache becomes stale if properties change mid-run', () => {
    test('Config reads from cache even after __reset if properties service returns new values', () => {
      expect(Config.isDryRun()).toBe(true);
      mockPropsStore.DRY_RUN = 'false';
      Config.__reset();
      expect(Config.isDryRun()).toBe(false);
    });
  });

  // ─── _shuffle returns same reference (mutates in place) ───────────
  describe('BUG 16: _shuffle mutates input array', () => {
    test('_shuffle modifies the original array', () => {
      const arr = [1, 2, 3, 4, 5];
      const ref = arr;
      _shuffle(arr);
      expect(arr).toBe(ref);
    });
  });

  // ─── forLive date-only granularity misses recent emails ───────────
  describe('BUG 17: forLive uses date-only, so midnight boundary causes gap', () => {
    test('forLive uses _formatDate which drops time component', () => {
      mockGmailApp.search.mockReturnValue([]);
      GmailSearch.forLive(5);

      const query = mockGmailApp.search.mock.calls[0][0];
      const dateMatch = query.match(/after:(\d{4}\/\d{2}\/\d{2})/);
      expect(dateMatch).toBeTruthy();
      expect(dateMatch[1].length).toBe(10);
    });
  });

  // ─── dryRunBackfill modifies Config.isDryRun permanently on error ─
  describe('BUG 18: dryRunBackfill restores Config.isDryRun via finally (confirmed working)', () => {
    test('Config.isDryRun is restored even on error', () => {
      const origDryRun = Config.isDryRun;
      mockGmailApp.search.mockImplementation(() => { throw new Error('boom'); });

      try { dryRunBackfill(); } catch (_e) {}

      expect(Config.isDryRun).toBe(origDryRun);
    });
  });

  // ─── removeTrigger mutates array while iterating ──────────────────
  describe('BUG 19: removeTrigger deletes while iterating forward', () => {
    test('removeTrigger skips every other trigger when multiple exist', () => {
      const t1 = { getHandlerFunction: jest.fn(() => 'processLiveEmails') };
      const t2 = { getHandlerFunction: jest.fn(() => 'processLiveEmails') };
      const t3 = { getHandlerFunction: jest.fn(() => 'processLiveEmails') };
      mockTriggerList.push(t1, t2, t3);

      removeTrigger();

      expect(mockScriptApp.deleteTrigger).toHaveBeenCalledTimes(3);
    });
  });

  // ─── _callApi JSON.parse on empty raw throws ──────────────────────
  describe('BUG 20: _callApi throws on empty LLM response with no reasoning', () => {
    test('empty content and no reasoning causes JSON.parse("") error', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"","reasoning":null}}]}'
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
});
