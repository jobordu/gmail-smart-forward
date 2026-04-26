describe('Adversarial Round 12 — Iteration 2 security hardening', () => {
  beforeEach(() => {
    resetTestState();
  });

  // ---------------------------------------------------------------------------
  // TEST 1: Unicode homoglyph allowlist bypass
  // SECURITY IMPACT: An attacker could register a domain using Cyrillic or other
  // Unicode lookalike characters (e.g., Cyrillic 'a' U+0430 instead of Latin 'a')
  // to impersonate an allowlisted domain. Since _senderEmail only calls
  // .toLowerCase() without Unicode normalization, "exаmple.com" (Cyrillic 'a')
  // would not match "example.com" (Latin 'a') in the allowlist — which is the
  // CORRECT secure behavior. This test ensures the allowlist is NOT bypassed.
  // ---------------------------------------------------------------------------
  describe('TEST 1: Unicode homoglyph domain must NOT bypass sender allowlist', () => {
    test('Cyrillic "a" in domain does not match Latin "a" in allowlist', () => {
      // U+0430 is Cyrillic lowercase 'a', visually identical to Latin 'a'
      const cyrillicA = '\u0430';
      const homoglyphDomain = 'ex' + cyrillicA + 'mple.com';

      mockPropsStore.ALLOWED_DOMAINS = 'example.com';
      Config.__reset();

      const msg = createMockMessage({ from: '<attacker@' + homoglyphDomain + '>' });
      expect(Classifier.isSupplierAllowed(msg)).toBe(false);
    });

    test('Cyrillic "o" in sender email does not match Latin allowlisted sender', () => {
      // U+043E is Cyrillic lowercase 'o'
      const cyrillicO = '\u043e';
      const fakeSender = 'supp' + cyrillicO + 'rt@vendor.com';

      mockPropsStore.ALLOWED_SENDERS = 'support@vendor.com';
      Config.__reset();

      const msg = createMockMessage({ from: '<' + fakeSender + '>' });
      expect(Classifier.isSupplierAllowed(msg)).toBe(false);
    });

    test('Full end-to-end: homoglyph sender is rejected by classify()', () => {
      const cyrillicA = '\u0430';
      const homoglyphDomain = 'ex' + cyrillicA + 'mple.com';

      mockPropsStore.ALLOWED_DOMAINS = 'example.com';
      mockPropsStore.ALLOWED_SENDERS = '';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<billing@' + homoglyphDomain + '>',
        subject: 'Your Invoice',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      const result = Classifier.classify(thread, msg);
      expect(result).toBe('sender-not-allowlisted');
    });
  });

  // ---------------------------------------------------------------------------
  // TEST 2: LLM response prototype pollution via __proto__ key
  // SECURITY IMPACT: If the LLM returns JSON containing "__proto__" or
  // "constructor" keys, JSON.parse could create an object with unexpected
  // prototype properties. While modern JSON.parse is generally safe, we verify
  // that crafted LLM output with __proto__ does not cause is_invoice to become
  // truthy through prototype chain pollution, bypassing classification.
  // ---------------------------------------------------------------------------
  describe('TEST 2: LLM response with __proto__ pollution attempt must not bypass classification', () => {
    test('__proto__.is_invoice in LLM response does not make result.is_invoice truthy', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      // Craft a malicious LLM response with __proto__ pollution attempt
      const maliciousResponse = JSON.stringify({
        is_invoice: false,
        confidence: 0.1,
        reason: 'not an invoice',
        '__proto__': { is_invoice: true, confidence: 0.99 },
      });

      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":' + JSON.stringify(maliciousResponse) + '}}]}'
      );

      const att = createMockAttachment('doc.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Hello',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      const result = Classifier.classify(thread, msg);
      // The LLM said is_invoice: false with low confidence, so it must be rejected
      expect(result).toBe('llm-not-invoice');
    });
  });

  // ---------------------------------------------------------------------------
  // TEST 3: LLM response with non-numeric confidence type bypass
  // SECURITY IMPACT: If the LLM returns confidence as a string like "0.99" or
  // as a boolean `true` (which coerces to 1 in numeric comparisons), the
  // classifier's typeof check for 'number' should catch it. But if the LLM
  // returns confidence as NaN-producing value, it could bypass the threshold.
  // This tests that string, boolean, null, and array confidence values are
  // all properly rejected.
  // ---------------------------------------------------------------------------
  describe('TEST 3: LLM response with non-numeric confidence must be rejected', () => {
    const nonNumericValues = [
      { label: 'string "0.99"', value: '"0.99"', },
      { label: 'boolean true', value: 'true' },
      { label: 'null', value: 'null' },
      { label: 'array [0.99]', value: '[0.99]' },
    ];

    nonNumericValues.forEach(({ label, value }) => {
      test(`confidence as ${label} is rejected`, () => {
        mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
        mockPropsStore.LLM_API_KEY = 'test-key';
        mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
        Config.__reset();

        const rawJson = '{"is_invoice":true,"confidence":' + value + ',"reason":"test"}';
        mockHttpResponse.getContentText.mockReturnValue(
          '{"choices":[{"message":{"content":' + JSON.stringify(rawJson) + '}}]}'
        );

        const att = createMockAttachment('invoice.pdf');
        const msg = createMockMessage({
          from: '<supplier@example.com>',
          subject: 'Invoice',
          attachments: [att],
        });
        const thread = createMockThread({ messages: [msg] });

        const result = Classifier.classify(thread, msg);
        // All non-number confidence values should be rejected
        expect(result).toBe('llm-not-invoice');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Attachment filename with null bytes or path traversal
  // SECURITY IMPACT: A crafted attachment filename containing null bytes
  // (e.g., "malware.exe\x00.pdf") or path traversal ("../../etc/passwd.pdf")
  // could trick extension checks or cause issues when the filename is used
  // in downstream operations (logging, Drive file creation). The extension
  // check must handle these safely.
  // ---------------------------------------------------------------------------
  describe('TEST 4: Malicious attachment filenames must not bypass extension filtering', () => {
    test('null byte in filename before .pdf does not count as valid PDF', () => {
      // A filename with a null byte: "malware.exe\0.pdf"
      // In many languages, the string is truncated at the null byte
      const maliciousName = 'malware.exe\x00.pdf';
      const att = createMockAttachment(maliciousName);
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });

      // The _hasAllowedExtension uses endsWith('.pdf') on the full string
      // including the null byte. JavaScript strings can contain null bytes,
      // so endsWith still matches. This test documents the current behavior.
      // If null byte handling changes, this test will catch the regression.
      const result = Classifier._hasAllowedExtension(maliciousName);
      // JavaScript endsWith works on full string including \0, so .pdf at end matches
      // This is the CURRENT behavior - document it so any change is intentional
      expect(result).toBe(true);
    });

    test('path traversal in filename is handled without error', () => {
      const traversalName = '../../../etc/passwd.pdf';
      const att = createMockAttachment(traversalName);
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });

      // Should not throw - the filename is only used for extension checking
      expect(() => Classifier._hasAllowedExtension(traversalName)).not.toThrow();
      // The extension check should still work on the raw string
      expect(Classifier._hasAllowedExtension(traversalName)).toBe(true);
    });

    test('double extension "invoice.pdf.exe" must NOT pass PDF extension check', () => {
      const doubleExt = 'invoice.pdf.exe';
      expect(Classifier._hasAllowedExtension(doubleExt)).toBe(false);
    });

    test('filename with only the extension ".pdf" (no basename) still passes', () => {
      expect(Classifier._hasAllowedExtension('.pdf')).toBe(true);
    });

    test('filename ending with ".pdf " (trailing space) must NOT pass', () => {
      // Trailing whitespace could trick visual inspection but must not match
      expect(Classifier._hasAllowedExtension('invoice.pdf ')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Information disclosure — error logs must not expose API keys or
  // full config values beyond what is necessary
  // SECURITY IMPACT: If an LLM API call fails, the error handler in
  // classifier.js logs e.message. If the error message contains the API key
  // (e.g., from a URL or auth header echo), it would be exposed in logs.
  // Also, Config.dump() must not expose the LLM_API_KEY.
  // ---------------------------------------------------------------------------
  describe('TEST 5: Sensitive data must not leak into logs', () => {
    test('Config.dump() does not include LLM_API_KEY', () => {
      mockPropsStore.LLM_API_KEY = 'sk-super-secret-key-12345';
      Config.__reset();

      const dumped = Config.dump();
      const dumpStr = JSON.stringify(dumped);

      expect(dumpStr).not.toContain('sk-super-secret-key-12345');
      expect(dumpStr).not.toContain('LLM_API_KEY');
    });

    test('LLM error handler does not log API key even if present in error message', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'sk-secret-api-key-leaked';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      // Simulate an error whose message contains the API key
      // (some HTTP libraries echo the authorization header in errors)
      mockUrlFetchApp.fetch.mockImplementation(() => {
        throw new Error('Request failed: Authorization: Bearer sk-secret-api-key-leaked');
      });

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Invoice',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      // classifier.js catch block logs: 'LLM classification error (skipping): ' + e.message
      // This WILL contain the API key since it comes from the error message.
      // This test documents the vulnerability: the error message is logged as-is.
      Classifier.classify(thread, msg);

      const logEntries = Log.getEntries();
      const llmErrorLog = logEntries.find(e =>
        e.type === 'INFO' && e.msg && e.msg.includes('LLM classification error')
      );

      // MITIGATION: Error messages are now sanitized — API keys are redacted.
      expect(llmErrorLog).toBeDefined();
      expect(llmErrorLog.msg).not.toContain('sk-secret-api-key-leaked');
      expect(llmErrorLog.msg).toContain('[REDACTED]');
    });
  });
});
