describe('Adversarial Round 14 — Iteration 4 security hardening', () => {
  beforeEach(() => {
    resetTestState();
  });

  // ---------------------------------------------------------------------------
  // TEST 1: backfillSender Gmail query injection
  // SECURITY IMPACT: backfillSender(senderEmail) builds a Gmail query using
  // string concatenation: 'from:' + senderEmail. If the senderEmail argument
  // contains spaces or Gmail search operators, an attacker could inject
  // arbitrary query terms such as "anything OR in:sent OR from:ceo@company.com"
  // to exfiltrate emails from other senders or sent mail.
  // Unlike SUBJECT_KEYWORDS (admin-controlled config), backfillSender is a
  // function parameter that could receive user-supplied input.
  // FINDING: senderEmail is NOT sanitized or quoted before query construction.
  // ---------------------------------------------------------------------------
  describe('TEST 1: backfillSender query injection via senderEmail parameter', () => {
    test('senderEmail with injected Gmail operators reaches the query unsanitized', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.DRY_RUN = 'true';
      Config.__reset();

      mockGmailApp.search.mockReturnValue([]);

      // Attacker-controlled input: inject "in:sent" to search sent mail
      backfillSender('anything OR in:sent OR from:ceo@company.com');

      expect(mockGmailApp.search).toHaveBeenCalled();
      const query = mockGmailApp.search.mock.calls[0][0];

      // MITIGATION: senderEmail is now quoted in the from: clause.
      // The query should contain from:"..." preventing injection.
      expect(query).toContain('from:"anything OR in:sent OR from:ceo@company.com"');
      // Strip the quoted from:"..." clause and verify injected operators don't appear outside it
      const sanitizedQuery = query.replace(/from:"[^"]*"/, '');
      expect(sanitizedQuery).not.toContain('OR in:sent');
    });

    test('senderEmail with curly braces / special chars passes through unescaped', () => {
      mockPropsStore.DRY_RUN = 'true';
      Config.__reset();

      mockGmailApp.search.mockReturnValue([]);

      // Gmail supports { } for grouping — injecting these could alter query logic
      backfillSender('{from:attacker@evil.com from:ceo@corp.com}');

      const query = mockGmailApp.search.mock.calls[0][0];
      // MITIGATION: The curly braces are now contained within quotes
      expect(query).toContain('from:"{from:attacker@evil.com from:ceo@corp.com}"');
    });
  });

  // ---------------------------------------------------------------------------
  // TEST 2: _getInt has no upper bound — extremely large MAX_EMAILS_PER_RUN
  // SECURITY IMPACT: _getInt(key, default) rejects NaN and negative values
  // but accepts arbitrarily large positive integers. Setting
  // MAX_EMAILS_PER_RUN to Number.MAX_SAFE_INTEGER (or a very large number)
  // causes the _search pagination loop in gmail-search.js to potentially
  // iterate for an extremely long time (up to maxResults/100 iterations),
  // which is a resource exhaustion / DoS vector in Apps Script's 6-minute
  // execution limit.
  // Additionally, _getInt returns the raw parseInt result — there's no
  // clamping to a sensible maximum.
  // ---------------------------------------------------------------------------
  describe('TEST 2: _getInt accepts extremely large values without upper bound', () => {
    test('MAX_EMAILS_PER_RUN with very large value is accepted as-is', () => {
      mockPropsStore.MAX_EMAILS_PER_RUN = '999999999';
      Config.__reset();

      const result = Config.getMaxEmailsPerRun();
      // No clamping — the raw parsed value is returned
      expect(result).toBe(999999999);
      // Mitigation: Add an upper bound, e.g., Math.min(val, 10000)
    });

    test('DISCOVERY_DAYS with absurdly large value is accepted', () => {
      mockPropsStore.DISCOVERY_DAYS = '9007199254740991'; // Number.MAX_SAFE_INTEGER
      Config.__reset();

      const result = Config.getDiscoveryDays();
      expect(result).toBe(9007199254740991);
      // A discovery search going back ~24 trillion years is clearly unintended.
      // The daysAgo calculation will produce an invalid Date, but Gmail
      // will likely just return all results or error out.
    });

    test('_getInt with value just above MAX_SAFE_INTEGER wraps to NaN and returns default', () => {
      // parseInt of a number above MAX_SAFE_INTEGER still parses (imprecisely),
      // so it does NOT return NaN — it returns an imprecise large number.
      mockPropsStore.MAX_EMAILS_PER_RUN = '99999999999999999999';
      Config.__reset();

      const result = Config.getMaxEmailsPerRun();
      // parseInt('99999999999999999999', 10) === 100000000000000000000 (imprecise)
      // which is > 0, so it passes the validation. This is a numeric precision bug.
      expect(result).toBeGreaterThan(0);
      expect(Number.isSafeInteger(result)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Log injection invariant — JSON.stringify safely encodes control chars
  // INVARIANT TEST: Confirms that crafted email metadata (from, subject)
  // containing newlines, tabs, and other control characters are safely
  // serialized via JSON.stringify and do not produce raw newlines in log output.
  // This prevents log forging attacks where an attacker crafts email content
  // to inject fake log entries (e.g., a fake "FORWARDED" entry that confuses
  // log analysis tools).
  // ---------------------------------------------------------------------------
  describe('TEST 3: Log output safely encodes control characters in email fields', () => {
    test('newlines and control chars in subject/from are JSON-escaped in log output', () => {
      mockPropsStore.FORWARD_TO_EMAIL = 'target@test.com';
      Config.__reset();

      const maliciousFrom = 'Attacker\r\n{"type":"FORWARDED","to":"hacker@evil.com"}\n<evil@attacker.com>';
      const maliciousSubject = 'Invoice\n\n{"type":"FORWARDED","injected":true}';

      const msg = createMockMessage({
        from: maliciousFrom,
        subject: maliciousSubject,
      });
      const thread = createMockThread({ messages: [msg] });

      Log.forwarded(msg, thread);

      // The Logger.log calls should contain JSON-escaped versions
      // (no raw newlines that could split log entries)
      const logOutput = mockLoggerLogs.join('');
      // Raw \r\n must NOT appear — they should be escaped as \\r\\n in JSON
      const parsed = JSON.parse(mockLoggerLogs[mockLoggerLogs.length - 1]);
      expect(parsed.from).toBe(maliciousFrom);
      expect(parsed.subject).toBe(maliciousSubject);

      // The serialized JSON string should not contain unescaped newlines
      const rawJson = mockLoggerLogs[mockLoggerLogs.length - 1];
      // Split by actual newline — JSON.stringify should produce a single line
      const lines = rawJson.split('\n');
      expect(lines.length).toBe(1);
    });

    test('Log.rejected also safely encodes injected content', () => {
      Config.__reset();

      const msg = createMockMessage({
        from: 'x\r\n\x00@evil.com',
        subject: 'test\x1b[31m\nINJECTED',
      });
      const thread = createMockThread({ messages: [msg] });

      Log.rejected(msg, thread, 'test-reason');

      const rawJson = mockLoggerLogs[mockLoggerLogs.length - 1];
      const lines = rawJson.split('\n');
      expect(lines.length).toBe(1);

      const parsed = JSON.parse(rawJson);
      expect(parsed.type).toBe('REJECTED');
      expect(parsed.reason).toBe('test-reason');
      // The special characters are preserved in the parsed object
      expect(parsed.from).toContain('\x00');
    });
  });

  // ---------------------------------------------------------------------------
  // TEST 4: LLM_BASE_URL lacks scheme/host validation (SSRF surface)
  // SECURITY IMPACT: Config.getLlmBaseUrl() returns whatever is in the
  // LLM_BASE_URL config property with no validation. _callApi() then
  // constructs an endpoint via baseUrl + '/chat/completions' and passes
  // it to UrlFetchApp.fetch(). If an attacker gains write access to
  // Script Properties, they could set LLM_BASE_URL to:
  //   - http://169.254.169.254/latest/meta-data (cloud metadata SSRF)
  //   - file:///etc/passwd (local file read, though unlikely in GAS)
  //   - http://internal-server:8080 (internal network scanning)
  // While this is admin-controlled, defense-in-depth should validate
  // that the URL uses HTTPS and doesn't point to private IP ranges.
  // ---------------------------------------------------------------------------
  describe('TEST 4: LLM_BASE_URL accepts arbitrary URLs without validation', () => {
    test('non-HTTPS URL is accepted without warning', () => {
      mockPropsStore.LLM_BASE_URL = 'http://169.254.169.254/latest/meta-data';
      Config.__reset();

      // MITIGATION: _callApi now rejects non-HTTPS URLs.
      // The raw config value is still returned, but _callApi will throw.
      const url = Config.getLlmBaseUrl();
      expect(url).toBe('http://169.254.169.254/latest/meta-data');
    });

    test('_callApi rejects non-HTTPS base URL', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.LLM_BASE_URL = 'http://internal-server:8080/api';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Invoice',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      // MITIGATION: _callApi throws for non-HTTPS URLs.
      // classify catches the error and fails open.
      Classifier.classify(thread, msg);

      // UrlFetchApp.fetch should NOT have been called
      expect(mockUrlFetchApp.fetch).not.toHaveBeenCalled();
    });

    test('_callApi rejects ftp:// scheme', () => {
      mockPropsStore.LLM_BASE_URL = 'ftp://evil.com///';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      // MITIGATION: non-HTTPS schemes are rejected
      expect(() => LlmClassifier.classifyInvoice(
        createMockMessage({ from: '<s@e.com>', attachments: [createMockAttachment('i.pdf')] }),
        createMockThread({ messages: [createMockMessage({ from: '<s@e.com>' })] })
      )).toThrow(/HTTPS/);
    });
  });
});
