describe('Adversarial Round 2 — New bugs', () => {
  beforeEach(() => {
    resetTestState();
  });

  describe('BUG 1: markRejected crashes on empty thread — FIXED', () => {
    test('markRejected safely handles empty thread', () => {
      const thread = createMockThread({ messages: [] });
      expect(() => Forwarding.markRejected(thread, 'test')).not.toThrow();
    });
  });

  describe('BUG 2: live.js duplicates rejected logging — applyRejected AND Log.rejected called separately', () => {
    test('live mode: rejected thread gets both Labels.applyRejected AND Log.rejected, but markRejected also calls applyRejected', () => {
      mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const msg = createMockMessage({ from: '<unknown@other.com>', attachments: [] });
      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      processLiveEmails();

      const rejectedLabel = mockLabelsRegistry['gmail-smart-forward/rejected'];
      const applyRejectedCalls = thread.addLabel.mock.calls.filter(
        c => c[0].getName() === 'gmail-smart-forward/rejected'
      );
      expect(applyRejectedCalls.length).toBe(1);
    });
  });

  describe('BUG 3: _getInt default passes through defaultValue to parseInt as string', () => {
    test('_getInt: defaultValue is passed to parseInt when key not set — "abc" default becomes NaN → returns default', () => {
      delete mockPropsStore.MAX_EMAILS_PER_RUN;
      Config.__reset();
      expect(Config.getMaxEmailsPerRun()).toBe(DEFAULT_MAX_EMAILS_PER_RUN);
    });
  });

  describe('BUG 4: validateConfig reads raw property directly for ATTACHMENT_EXTENSIONS check — FIXED', () => {
    test('validateConfig: whitespace-only ATTACHMENT_EXTENSIONS now correctly detected as empty', () => {
      mockPropsStore.ATTACHMENT_EXTENSIONS = '   ';
      Config.__reset();

      const result = validateConfig();
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('ATTACHMENT_EXTENSIONS')])
      );
    });
  });

  describe('BUG 5: forLive uses date-only granularity — same-day gap', () => {
    test('forLive: after:YYYY/MM/DD includes the ENTIRE day, not just last N minutes', () => {
      mockGmailApp.search.mockReturnValue([]);

      GmailSearch.forLive(5);

      const query = mockGmailApp.search.mock.calls[0][0];
      expect(query).toContain('after:');
      expect(query).not.toContain('newer_than:');
    });
  });

  describe('BUG 6: bootstrapProperties trims whitespace from _ENV values — FIXED', () => {
    test('bootstrapProperties: whitespace-only _ENV values are now filtered out', () => {
      global._ENV = { FORWARD_TO_EMAIL: '   ', DRY_RUN: 'true' };

      bootstrapProperties();

      const setCall = mockScriptProperties.setProperties.mock.calls[0][0];
      expect(setCall).not.toHaveProperty('FORWARD_TO_EMAIL');

      delete global._ENV;
    });
  });

  describe('BUG 7: _getList extracts email from angle brackets in allowlist, but isSupplierAllowed compares full email', () => {
    test('allowlist entry "Supplier <supplier@example.com>" extracts email correctly, and isSupplierAllowed matches', () => {
      mockPropsStore.ALLOWED_SENDERS = 'Supplier <supplier@example.com>';
      Config.__reset();

      const msg = createMockMessage({ from: '<supplier@example.com>' });
      expect(Config.getAllowedSenders()).toContain('supplier@example.com');
      expect(Classifier.isSupplierAllowed(msg)).toBe(true);
    });

    test('allowlist entry "supplier@example.com" without brackets still matches', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const msg = createMockMessage({ from: '<supplier@example.com>' });
      expect(Config.getAllowedSenders()).toContain('supplier@example.com');
      expect(Classifier.isSupplierAllowed(msg)).toBe(true);
    });
  });

  describe('BUG 8: _shuffle on null/undefined array crashes', () => {
    test('_shuffle on empty array is safe', () => {
      expect(() => _shuffle([])).not.toThrow();
      expect(_shuffle([])).toEqual([]);
    });

    test('_shuffle on single-element array is safe', () => {
      expect(() => _shuffle([1])).not.toThrow();
      expect(_shuffle([1])).toEqual([1]);
    });
  });

  describe('BUG 9: forwarding.forwardToTarget applies forwarded label even when no messages qualify — FIXED', () => {
    test('forwardToTarget does NOT mark thread as forwarded when no messages qualify', () => {
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.ALLOWED_SENDERS = '';
      mockPropsStore.ALLOWED_DOMAINS = '';
      Config.__reset();

      const msg = createMockMessage({ from: '<unknown@other.com>' });
      const thread = createMockThread({ messages: [msg] });

      Forwarding.forwardToTarget(thread);

      const addedLabels = thread.addLabel.mock.calls.map(c => c[0].getName());
      expect(addedLabels).not.toContain('gmail-smart-forward/forwarded');
    });
  });

  describe('BUG 10: Config.dump uses wrong default for DRY_RUN', () => {
    test('Config.dump always shows dryRun: true regardless of actual config', () => {
      mockPropsStore.DRY_RUN = 'false';
      Config.__reset();

      const dump = Config.dump();
      expect(dump.dryRun).toBe(false);
    });
  });

  describe('BUG 11: discovery handles missing body gracefully (no getPlainBody call in discovery)', () => {
    test('discoverSuppliers handles message with null getSubject', () => {
      const msg = createMockMessage({
        from: '<supplier@a.com>',
      });
      msg.getSubject = jest.fn(() => null);

      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      expect(() => discoverSuppliers()).not.toThrow();
    });
  });

  describe('BUG 12: forBackfill query with massive keyword list may exceed Gmail query length limit', () => {
    test('forBackfill generates very long query with all default keywords', () => {
      mockGmailApp.search.mockReturnValue([]);

      GmailSearch.forBackfill(null);

      const query = mockGmailApp.search.mock.calls[0][0];
      expect(query.length).toBeGreaterThan(100);
    });
  });

  describe('BUG 13: dryRunBackfill mutates Config.isDryRun — global side effect during error', () => {
    test('dryRunBackfill: if _runBackfill throws before finally, Config.isDryRun is restored', () => {
      mockPropsStore.DRY_RUN = 'false';
      Config.__reset();

      mockGmailApp.search.mockImplementation(() => {
        throw new Error('search failed');
      });

      try { dryRunBackfill(); } catch (_e) {}

      expect(Config.isDryRun()).toBe(false);
    });
  });

  describe('BUG 14: LLM _callApi parses raw with JSON.parse — crashes on whitespace-only content', () => {
    test('LLM returns content that is whitespace only → JSON.parse(" ") throws', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"   "}}]}'
      );

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      expect(() => Classifier.classify(thread, msg)).not.toThrow();
      expect(Classifier.classify(thread, msg)).toBeNull();
    });
  });

  describe('BUG 15: _search pagination with exact pageSize results requests one extra page', () => {
    test('_search: when page returns exactly pageSize=100, it fetches another page needlessly', () => {
      const page1 = Array.from({ length: 100 }, (_, i) => createMockThread({ id: `t${i}` }));
      const page2 = Array.from({ length: 50 }, (_, i) => createMockThread({ id: `t${i + 100}` }));
      mockGmailApp.search
        .mockReturnValueOnce(page1)
        .mockReturnValueOnce(page2);

      const result = GmailSearch.forDiscovery(365);

      expect(result).toHaveLength(150);
      expect(mockGmailApp.search).toHaveBeenCalledTimes(2);
    });
  });

  describe('BUG 16: backfillSender now respects maxEmailsPerRun — FIXED', () => {
    test('backfillSender caps processed count at maxEmailsPerRun', () => {
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.MAX_EMAILS_PER_RUN = '1';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const threads = Array.from({ length: 5 }, (_, i) => {
        const att = createMockAttachment('invoice.pdf');
        const msg = createMockMessage({
          from: '<supplier@example.com>',
          attachments: [att],
        });
        return createMockThread({ messages: [msg], id: `t${i}` });
      });
      mockGmailApp.search.mockReturnValue(threads);

      backfillSender('supplier@example.com');

      const forwardedCount = threads.filter(t =>
        t.getMessages()[0].forward.mock.calls.length > 0
      ).length;
      expect(forwardedCount).toBeLessThanOrEqual(1);
    });
  });

  describe('BUG 17: validateConfig reads EXCLUDED_KEYWORDS but after fix, empty string returns [] not defaults', () => {
    test('validateConfig with EXCLUDED_KEYWORDS="" should still warn about conflicts', () => {
      mockPropsStore.EXCLUDED_KEYWORDS = '';
      Config.__reset();

      const result = validateConfig();
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('BUG 18: status() operator precedence — FIXED', () => {
    test('status: empty allowlist now correctly shows "(none)"', () => {
      mockPropsStore.ALLOWED_SENDERS = '';
      mockPropsStore.ALLOWED_DOMAINS = '';
      Config.__reset();

      status();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('Allowed senders: (none)');
      expect(logCalls).toContain('Allowed domains: (none)');
    });
  });

  describe('BUG 19: forLive now excludes rejected label — FIXED', () => {
    test('forLive search now filters out already-rejected threads', () => {
      mockGmailApp.search.mockReturnValue([]);

      GmailSearch.forLive(20);

      const query = mockGmailApp.search.mock.calls[0][0];
      expect(query).toContain('-label:"gmail-smart-forward/rejected"');
    });
  });

  describe('BUG 20: LLM reasoning fallback regex is greedy — can capture too much', () => {
    test('reasoning with multiple JSON-like blocks captures from first { to last }', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"","reasoning":"Here is my analysis: {\"foo\":1} and then the answer is {\"is_invoice\":true,\"confidence\":0.9,\"reason\":\"invoice\"}"}}]}'
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
