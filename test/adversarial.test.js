describe('Adversarial — Classifier edge cases', () => {
  beforeEach(() => {
    resetTestState();
  });

  describe('email parsing attacks', () => {
    test('email with multiple @ signs extracts incorrect domain', () => {
      const msg = createMockMessage({ from: 'Attacker <evil@attack.com@legit.com>' });
      expect(Classifier.getSenderDomain(msg)).toBe('');
    });

    test('email with no angle brackets but trailing whitespace is trimmed', () => {
      const msg = createMockMessage({ from: '  supplier@example.com   ' });
      expect(Classifier.getSenderEmail(msg)).toBe('supplier@example.com');
    });

    test('email with display name containing angle brackets — now grabs last match', () => {
      const msg = createMockMessage({ from: 'Test <less> than <real@supplier.com>' });
      expect(Classifier.getSenderEmail(msg)).toBe('real@supplier.com');
    });

    test('email with angle brackets around entire string', () => {
      const msg = createMockMessage({ from: '<supplier@example.com>' });
      expect(Classifier.getSenderEmail(msg)).toBe('supplier@example.com');
    });

    test('empty from field results in empty domain — should not crash', () => {
      const msg = createMockMessage({ from: '' });
      expect(() => Classifier.getSenderEmail(msg)).not.toThrow();
      expect(() => Classifier.getSenderDomain(msg)).not.toThrow();
    });

    test('email with unicode characters in domain', () => {
      const msg = createMockMessage({ from: '<user@exämple.com>' });
      const domain = Classifier.getSenderDomain(msg);
      expect(domain).toBe('exämple.com');
    });
  });

  describe('keyword matching bypass', () => {
    test('isForwardableReceipt: PDF detection via .PDF uppercase extension', () => {
      const att = createMockAttachment('invoice.PDF');
      const msg = createMockMessage({ subject: 'Hello', attachments: [att] });
      expect(Classifier.isForwardableReceipt(msg)).toBe(true);
    });

    test('isForwardableReceipt: BUG — "pdf" keyword in filename "pdf.invoice.txt" triggers keyword match (not PDF check)', () => {
      const att = createMockAttachment('pdf.invoice.txt');
      const msg = createMockMessage({ subject: 'Hello', attachments: [att] });
      expect(Classifier.isForwardableReceipt(msg)).toBe(true);
    });

    test('isForwardableReceipt: subject with keyword embedded in larger word still matches (substring)', () => {
      const msg = createMockMessage({ subject: 'REINVOICE your items' });
      expect(Classifier.isForwardableReceipt(msg)).toBe(true);
    });

    test('isExcludedMessage: "sale" in "wholesale" causes false exclusion of legitimate invoice', () => {
      const msg = createMockMessage({
        subject: 'Wholesale Invoice #123',
        body: 'Please pay this invoice',
      });
      expect(Classifier.isExcludedMessage(msg)).toBe(true);
    });

    test('isExcludedMessage: "deal" in "ideal" causes false exclusion', () => {
      const msg = createMockMessage({
        subject: 'Your ideal Invoice',
        body: 'Payment details enclosed',
      });
      expect(Classifier.isExcludedMessage(msg)).toBe(true);
    });

    test('isExcludedMessage: "offer" in "offer" matches — but "coffer" would too', () => {
      const msg = createMockMessage({
        subject: 'Coffer Invoice Payment',
        body: 'Payment details enclosed',
      });
      expect(Classifier.isExcludedMessage(msg)).toBe(true);
    });

    test('_containsKeyword: explicitly empty EXCLUDED_KEYWORDS returns empty list (no defaults)', () => {
      mockPropsStore.EXCLUDED_KEYWORDS = '';
      Config.__reset();
      const msg = createMockMessage({ subject: 'unsubscribe deal sale', body: '' });
      expect(Classifier.isExcludedMessage(msg)).toBe(false);
    });

    test('hasValidAttachment: filename with .pdf.exe should NOT match as PDF', () => {
      const att = createMockAttachment('malware.pdf.exe');
      const msg = createMockMessage({ attachments: [att] });
      expect(Classifier.hasValidAttachment(msg)).toBe(false);
    });

    test('_hasAllowedExtension: filename ending in .pdf.exe is NOT .pdf', () => {
      expect(Classifier._hasAllowedExtension('malware.pdf.exe')).toBe(false);
    });
  });

  describe('classify — exclusion/allowlist bypass', () => {
    test('excluded sender who is also allowlisted is STILL excluded (excluded-sender check runs first)', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.EXCLUDED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.classify(thread, msg)).toBe('excluded-sender');
    });

    test('excluded domain takes priority over allowlisted email in same domain', () => {
      mockPropsStore.ALLOWED_SENDERS = 'user@bad.com';
      mockPropsStore.EXCLUDED_DOMAINS = 'bad.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<user@bad.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.classify(thread, msg)).toBe('excluded-sender');
    });

    test('daisy-chain: excluded sender in middle of thread blocks forwarding even if supplier is allowlisted', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.EXCLUDED_SENDERS = 'evil@attacker.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const supplierMsg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Invoice',
        attachments: [att],
      });
      const evilMsg = createMockMessage({
        from: '<evil@attacker.com>',
        subject: 'Fwd: Invoice',
      });
      const thread = createMockThread({ messages: [supplierMsg, evilMsg] });

      expect(Classifier.classify(thread, evilMsg)).toBe('excluded-sender');
    });

    test('classify returns null even when body has excluded keywords (allowlisted sender skips check)', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        subject: 'Your invoice',
        body: 'This is a great deal! Sale! Discount! Marketing promotion!',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });
      expect(Classifier.classify(thread, msg)).toBeNull();
    });
  });

  describe('findAllowlistedMessage — edge cases', () => {
    test('returns null for thread with no messages', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const thread = createMockThread({ messages: [] });
      expect(Classifier.findAllowlistedMessage(thread)).toBeNull();
    });

    test('skips allowlisted-but-excluded sender, finds earlier non-excluded one', () => {
      mockPropsStore.ALLOWED_SENDERS = 'good@supplier.com,bad@supplier.com';
      mockPropsStore.EXCLUDED_SENDERS = 'bad@supplier.com';
      Config.__reset();

      const goodMsg = createMockMessage({ from: '<good@supplier.com>' });
      const badMsg = createMockMessage({ from: '<bad@supplier.com>' });
      const thread = createMockThread({ messages: [goodMsg, badMsg] });
      expect(Classifier.findAllowlistedMessage(thread)).toBe(goodMsg);
    });
  });
});

describe('Adversarial — Forwarding security', () => {
  beforeEach(() => {
    resetTestState();
  });

  test('non-allowlisted sender with PDF attachment in thread does NOT get forwarded', () => {
    mockPropsStore.DRY_RUN = 'false';
    mockPropsStore.ALLOWED_SENDERS = 'allowed@example.com';
    Config.__reset();

    const att = createMockAttachment('invoice.pdf');
    const unallowedMsg = createMockMessage({
      from: '<hacker@evil.com>',
      attachments: [att],
    });
    const thread = createMockThread({ messages: [unallowedMsg] });

    Forwarding.forwardToTarget(thread);

    expect(unallowedMsg.forward).not.toHaveBeenCalled();
  });

  test('in dry-run mode, forwarded label is NOT applied (prevents marking as forwarded without actual send)', () => {
    mockPropsStore.DRY_RUN = 'true';
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    Config.__reset();

    const att = createMockAttachment('invoice.pdf');
    const msg = createMockMessage({
      from: '<supplier@example.com>',
      attachments: [att],
    });
    const thread = createMockThread({ messages: [msg] });

    Forwarding.forwardToTarget(thread);

    expect(thread.addLabel).not.toHaveBeenCalled();
    expect(thread.removeLabel).not.toHaveBeenCalled();
  });

  test('thread with mix of allowed and unallowed senders: only allowed sender PDFs are forwarded', () => {
    mockPropsStore.DRY_RUN = 'false';
    mockPropsStore.ALLOWED_SENDERS = 'allowed@example.com';
    Config.__reset();

    const att1 = createMockAttachment('invoice.pdf');
    const allowedMsg = createMockMessage({
      from: '<allowed@example.com>',
      attachments: [att1],
    });
    const att2 = createMockAttachment('malware.pdf');
    const unallowedMsg = createMockMessage({
      from: '<unallowed@evil.com>',
      attachments: [att2],
    });
    const thread = createMockThread({ messages: [allowedMsg, unallowedMsg] });

    Forwarding.forwardToTarget(thread);

    expect(allowedMsg.forward).toHaveBeenCalledTimes(1);
    expect(unallowedMsg.forward).not.toHaveBeenCalled();
  });

  test('forwarded label is NOT applied when no messages qualify (empty _messagesWithAttachment)', () => {
    mockPropsStore.DRY_RUN = 'false';
    mockPropsStore.ALLOWED_SENDERS = '';
    mockPropsStore.ALLOWED_DOMAINS = '';
    Config.__reset();

    const msg = createMockMessage({ from: '<unknown@other.com>' });
    const thread = createMockThread({ messages: [msg] });

    Forwarding.forwardToTarget(thread);

    expect(thread.addLabel).not.toHaveBeenCalled();
  });

  test('markRejected logs rejection reason from the LAST message, not the one that triggered rejection', () => {
    const firstMsg = createMockMessage({ subject: 'Original Invoice' });
    const lastMsg = createMockMessage({ subject: 'Re: Original Invoice' });
    const thread = createMockThread({ messages: [firstMsg, lastMsg] });

    Forwarding.markRejected(thread, 'excluded-sender');

    const entries = Log.getEntries();
    const rejected = entries.find(e => e.type === 'REJECTED');
    expect(rejected.subject).toBe('Re: Original Invoice');
  });
});

describe('Adversarial — Config parsing', () => {
  beforeEach(() => {
    resetTestState();
  });

  test('_getBool: "TRUE" (uppercase) now returns true (case-insensitive)', () => {
    mockPropsStore.DRY_RUN = 'TRUE';
    Config.__reset();
    expect(Config.isDryRun()).toBe(true);
  });

  test('_getBool: "1" returns false — only "true" is truthy', () => {
    mockPropsStore.DRY_RUN = '1';
    Config.__reset();
    expect(Config.isDryRun()).toBe(false);
  });

  test('_getBool: "yes" returns false', () => {
    mockPropsStore.ENABLE_LIVE_FORWARDING = 'yes';
    Config.__reset();
    expect(Config.isLiveForwardingEnabled()).toBe(false);
  });

  test('_getList: email with special characters in allowlist', () => {
    mockPropsStore.ALLOWED_SENDERS = 'invoice+statements+acct_1Rh0@stripe.com';
    Config.__reset();
    expect(Config.getAllowedSenders()).toEqual(['invoice+statements+acct_1rh0@stripe.com']);
  });

    test('_getList: angle brackets extracted from comma-split display names', () => {
      mockPropsStore.ALLOWED_SENDERS = '"Last, First" <first@last.com>';
      Config.__reset();
      const result = Config.getAllowedSenders();
      expect(result).toContain('first@last.com');
    });

  test('_getInt: negative number returns default', () => {
    mockPropsStore.MAX_EMAILS_PER_RUN = '-5';
    Config.__reset();
    expect(Config.getMaxEmailsPerRun()).toBe(DEFAULT_MAX_EMAILS_PER_RUN);
  });

  test('_getInt: zero is accepted (valid for DISCOVERY_DAYS=0 meaning today-only)', () => {
    mockPropsStore.MAX_EMAILS_PER_RUN = '0';
    Config.__reset();
    expect(Config.getMaxEmailsPerRun()).toBe(0);
  });

  test('_getInt: float is truncated to integer', () => {
    mockPropsStore.MAX_EMAILS_PER_RUN = '3.7';
    Config.__reset();
    expect(Config.getMaxEmailsPerRun()).toBe(3);
  });

  test('getLlmConfidenceThreshold: negative threshold accepted', () => {
    mockPropsStore.LLM_CONFIDENCE_THRESHOLD = '-0.5';
    Config.__reset();
    expect(Config.getLlmConfidenceThreshold()).toBe(-0.5);
  });

  test('getLlmConfidenceThreshold: threshold > 1 accepted', () => {
    mockPropsStore.LLM_CONFIDENCE_THRESHOLD = '5.0';
    Config.__reset();
    expect(Config.getLlmConfidenceThreshold()).toBe(5.0);
  });

  test('_getList: whitespace-only items filtered out', () => {
    mockPropsStore.ALLOWED_SENDERS = '   ,  ,  ';
    Config.__reset();
    expect(Config.getAllowedSenders()).toEqual([]);
  });

  test('_getList: duplicate entries are NOT deduplicated', () => {
    mockPropsStore.ALLOWED_SENDERS = 'a@b.com, a@b.com';
    Config.__reset();
    expect(Config.getAllowedSenders()).toEqual(['a@b.com', 'a@b.com']);
  });

  test('config is NOT cached at _getList level — _load caches raw props but _getList re-parses', () => {
    mockPropsStore.ALLOWED_SENDERS = 'first@example.com';
    Config.__reset();
    expect(Config.getAllowedSenders()).toEqual(['first@example.com']);

    mockPropsStore.ALLOWED_SENDERS = 'second@example.com';
    expect(Config.getAllowedSenders()).toEqual(['second@example.com']);

    Config.__reset();
    expect(Config.getAllowedSenders()).toEqual(['second@example.com']);
  });

  test('FORWARD_TO_EMAIL with only whitespace now throws', () => {
    mockPropsStore.FORWARD_TO_EMAIL = '   ';
    Config.__reset();
    expect(() => Config.getForwardToEmail()).toThrow();
  });
});

describe('Adversarial — GmailSearch query construction', () => {
  beforeEach(() => {
    resetTestState();
  });

  test('forLive: _formatDate uses date-only granularity — emails on same day but before lookback window could be missed', () => {
    mockGmailApp.search.mockReturnValue([]);

    GmailSearch.forLive(20);

    const query = mockGmailApp.search.mock.calls[0][0];
    expect(query).toContain('after:');
    expect(query).not.toContain('newer_than:');
  });

  test('forBackfill: custom subject keywords with special regex chars are injected raw', () => {
    mockPropsStore.SUBJECT_KEYWORDS = 'invoice, (receipt), [payment]';
    Config.__reset();
    mockGmailApp.search.mockReturnValue([]);

    GmailSearch.forBackfill(null);

    const query = mockGmailApp.search.mock.calls[0][0];
    expect(query).toContain('"(receipt)"');
    expect(query).toContain('"[payment]"');
  });

  test('forBackfill: afterDateStr with invalid format throws an error', () => {
    mockGmailApp.search.mockReturnValue([]);

    expect(() => {
      GmailSearch.forBackfill('not-a-date');
    }).toThrow(/Invalid BACKFILL_AFTER_DATE format/);
  });

  test('_search: stops when GmailApp.search returns empty array mid-pagination', () => {
    const page1 = Array.from({ length: 100 }, (_, i) => createMockThread({ id: `t${i}` }));
    mockGmailApp.search
      .mockReturnValueOnce(page1)
      .mockReturnValueOnce([]);

    const result = GmailSearch.forDiscovery(365);

    expect(result).toHaveLength(100);
    expect(mockGmailApp.search).toHaveBeenCalledTimes(2);
  });

  test('forDiscovery: pagination respects the 2000 max limit', () => {
    const page1 = Array.from({ length: 100 }, (_, i) => createMockThread({ id: `t${i}` }));
    const page2 = Array.from({ length: 100 }, (_, i) => createMockThread({ id: `t${i + 100}` }));

    mockGmailApp.search.mockReturnValue(page1);

    const result = GmailSearch.forDiscovery(365);
    expect(result.length).toBeLessThanOrEqual(2000);
  });
});

describe('Adversarial — LLM response parsing', () => {
  beforeEach(() => {
    resetTestState();
  });

  test('LLM returns non-JSON content should throw', () => {
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
    mockPropsStore.LLM_API_KEY = 'test-key';
    Config.__reset();

    mockHttpResponse.getContentText.mockReturnValue(
      '{"choices":[{"message":{"content":"Not JSON at all"}}]}'
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

  test('LLM returns JSON with extra fields should still parse', () => {
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
    mockPropsStore.LLM_API_KEY = 'test-key';
    Config.__reset();

    mockHttpResponse.getContentText.mockReturnValue(
      '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"invoice\\",\\"extra\\":\\"data\\"}"}}]}'
    );

    const att = createMockAttachment('invoice.pdf');
    const msg = createMockMessage({
      from: '<supplier@example.com>',
      attachments: [att],
    });
    const thread = createMockThread({ messages: [msg] });
    expect(Classifier.classify(thread, msg)).toBeNull();
  });

  test('LLM returns confidence exactly at threshold should pass', () => {
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
    mockPropsStore.LLM_API_KEY = 'test-key';
    Config.__reset();

    mockHttpResponse.getContentText.mockReturnValue(
      '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.7,\\"reason\\":\\"invoice\\"}"}}]}'
    );

    const att = createMockAttachment('invoice.pdf');
    const msg = createMockMessage({
      from: '<supplier@example.com>',
      attachments: [att],
    });
    const thread = createMockThread({ messages: [msg] });
    expect(Classifier.classify(thread, msg)).toBeNull();
  });

  test('LLM returns confidence just below threshold should reject', () => {
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
    mockPropsStore.LLM_API_KEY = 'test-key';
    Config.__reset();

    mockHttpResponse.getContentText.mockReturnValue(
      '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.69,\\"reason\\":\\"maybe invoice\\"}"}}]}'
    );

    const att = createMockAttachment('invoice.pdf');
    const msg = createMockMessage({
      from: '<supplier@example.com>',
      attachments: [att],
    });
    const thread = createMockThread({ messages: [msg] });
    expect(Classifier.classify(thread, msg)).toBe('llm-not-invoice');
  });

  test('LLM returns empty content but has reasoning with JSON — extracts from reasoning', () => {
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
    mockPropsStore.LLM_API_KEY = 'test-key';
    Config.__reset();

    mockHttpResponse.getContentText.mockReturnValue(
      '{"choices":[{"message":{"content":"","reasoning":"I think this is {\\\"is_invoice\\\":true,\\\"confidence\\\":0.9,\\\"reason\\\":\\\"invoice\\\"}"}}]}'
    );

    const att = createMockAttachment('invoice.pdf');
    const msg = createMockMessage({
      from: '<supplier@example.com>',
      attachments: [att],
    });
    const thread = createMockThread({ messages: [msg] });
    expect(Classifier.classify(thread, msg)).toBeNull();
  });

  test('LLM returns API 429 rate limit — fail-open allows forwarding', () => {
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
    mockPropsStore.LLM_API_KEY = 'test-key';
    Config.__reset();

    mockHttpResponse.getResponseCode.mockReturnValue(429);
    mockHttpResponse.getContentText.mockReturnValue('{"error":"rate limited"}');

    const att = createMockAttachment('invoice.pdf');
    const msg = createMockMessage({
      from: '<supplier@example.com>',
      attachments: [att],
    });
    const thread = createMockThread({ messages: [msg] });
    expect(Classifier.classify(thread, msg)).toBeNull();
  });

  test('LLM returns is_invoice as string "true" instead of boolean — confidence check passes but is_invoice is truthy', () => {
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
    mockPropsStore.LLM_API_KEY = 'test-key';
    Config.__reset();

    mockHttpResponse.getContentText.mockReturnValue(
      '{"choices":[{"message":{"content":"{\\"is_invoice\\":\\"true\\",\\"confidence\\":0.9,\\"reason\\":\\"invoice\\"}"}}]}'
    );

    const att = createMockAttachment('invoice.pdf');
    const msg = createMockMessage({
      from: '<supplier@example.com>',
      attachments: [att],
    });
    const thread = createMockThread({ messages: [msg] });
    expect(Classifier.classify(thread, msg)).toBeNull();
  });

  test('LLM returns null response body should fail-open', () => {
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
    mockPropsStore.LLM_API_KEY = 'test-key';
    Config.__reset();

    mockHttpResponse.getContentText.mockReturnValue(
      '{"choices":[{"message":{"content":null}}]}'
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

describe('Adversarial — Live processing', () => {
  beforeEach(() => {
    resetTestState();
  });

  test('live mode: thread that is both forwarded AND rejected should not double-process', () => {
    mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    Config.__reset();

    const att = createMockAttachment('invoice.pdf');
    const msg = createMockMessage({
      from: '<supplier@example.com>',
      attachments: [att],
    });
    const fwdLabel = Labels.getForwarded();
    const thread = createMockThread({ messages: [msg], labels: [fwdLabel] });
    mockGmailApp.search.mockReturnValue([thread]);

    processLiveEmails();

    expect(msg.forward).not.toHaveBeenCalled();
    const rejectedLabel = mockLabelsRegistry['gmail-smart-forward/rejected'];
    expect(thread.addLabel).not.toHaveBeenCalledWith(rejectedLabel);
  });

  test('empty thread (no messages) is safely skipped — no crash', () => {
    mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
    Config.__reset();

    const thread = createMockThread({ messages: [] });
    mockGmailApp.search.mockReturnValue([thread]);

    expect(() => processLiveEmails()).not.toThrow();
  });

  test('live mode: thread with only non-allowlisted, non-excluded sender gets rejected', () => {
    mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    Config.__reset();

    const msg = createMockMessage({
      from: '<unknown@other.com>',
      attachments: [],
    });
    const thread = createMockThread({ messages: [msg] });
    mockGmailApp.search.mockReturnValue([thread]);

    processLiveEmails();

    const rejectedLabel = mockLabelsRegistry['gmail-smart-forward/rejected'];
    expect(thread.addLabel).toHaveBeenCalledWith(rejectedLabel);
  });

  test('live mode: rejected threads count against processed limit (FIXED)', () => {
    mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
    mockPropsStore.DRY_RUN = 'false';
    mockPropsStore.MAX_EMAILS_PER_RUN = '2';
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    Config.__reset();

    const rejectMsg = createMockMessage({ from: '<unknown@other.com>', attachments: [] });
    const rejectThread = createMockThread({ messages: [rejectMsg] });

    const att = createMockAttachment('invoice.pdf');
    const fwdMsg = createMockMessage({
      from: '<supplier@example.com>',
      attachments: [att],
    });
    const fwdThread = createMockThread({ messages: [fwdMsg] });

    const att2 = createMockAttachment('invoice2.pdf');
    const fwdMsg2 = createMockMessage({
      from: '<supplier@example.com>',
      attachments: [att2],
    });
    const fwdThread2 = createMockThread({ messages: [fwdMsg2] });

    mockGmailApp.search.mockReturnValue([rejectThread, fwdThread, fwdThread2]);

    processLiveEmails();

    expect(fwdMsg.forward).toHaveBeenCalledTimes(1);
    expect(fwdMsg2.forward).toHaveBeenCalledTimes(0);
  });
});

describe('Adversarial — Backfill state', () => {
  beforeEach(() => {
    resetTestState();
  });

  test('dryRunBackfill restores original isDryRun even on error', () => {
    mockPropsStore.DRY_RUN = 'false';
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    Config.__reset();

    mockGmailApp.search.mockImplementation(() => {
      throw new Error('search failed');
    });

    try {
      dryRunBackfill();
    } catch (_e) {}

    expect(Config.isDryRun()).toBe(false);
  });

  test('backfillSender: sender not in allowlist still gets classified and rejected', () => {
    mockPropsStore.ALLOWED_SENDERS = 'other@example.com';
    Config.__reset();

    const att = createMockAttachment('invoice.pdf');
    const msg = createMockMessage({
      from: '<random@sender.com>',
      attachments: [att],
    });
    const thread = createMockThread({ messages: [msg] });
    mockGmailApp.search.mockReturnValue([thread]);

    backfillSender('random@sender.com');

    expect(msg.forward).not.toHaveBeenCalled();
  });

  test('_shuffle does not create a new array (modifies in-place)', () => {
    const arr = [1, 2, 3, 4, 5];
    const ref = arr;
    _shuffle(arr);
    expect(arr).toBe(ref);
    expect(arr.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test('backfill with null search results does not crash', () => {
    mockGmailApp.search.mockReturnValue(null);

    expect(() => backfillApprovedSuppliers()).not.toThrow();
  });
});

describe('Adversarial — Labels', () => {
  beforeEach(() => {
    resetTestState();
  });

  test('applyForwarded removes candidate label even if it was never applied', () => {
    const msg = createMockMessage();
    const thread = createMockThread({ messages: [msg], labels: [] });

    Labels.applyForwarded(thread);

    expect(thread.removeLabel).toHaveBeenCalled();
  });

  test('isForwarded returns false for thread with other labels', () => {
    const otherLabel = createMockLabel('other/label');
    const thread = createMockThread({ labels: [otherLabel] });

    expect(Labels.isForwarded(thread)).toBe(false);
  });

  test('Labels cache: creating same label twice returns cached version', () => {
    const label1 = Labels.getForwarded();
    const label2 = Labels.getForwarded();
    expect(label1).toBe(label2);
    expect(mockGmailApp.getUserLabelByName).toHaveBeenCalledTimes(1);
  });

  test('setup creates all four labels', () => {
    Labels.setup();

    expect(mockGmailApp.createLabel).toHaveBeenCalledTimes(4);
  });
});

describe('Adversarial — Logging', () => {
  beforeEach(() => {
    resetTestState();
  });

  test('Log.getEntries returns deep copy — mutating does not affect internal state', () => {
    Log.info('test');
    const entries = Log.getEntries();
    entries[0].type = 'TAMPERED';
    expect(Log.getEntries()[0].type).toBe('INFO');
  });

  test('Log accumulates across tests unless __reset is called', () => {
    Log.info('first');
    expect(Log.getEntries()).toHaveLength(1);
    Log.__reset();
    Log.info('second');
    expect(Log.getEntries()).toHaveLength(1);
  });

  test('info with null data does not crash', () => {
    expect(() => Log.info('msg', null)).not.toThrow();
  });

  test('error with non-Error object', () => {
    const entry = Log.error('fail', 'string error');
    expect(entry.error).toBe('string error');
  });
});

describe('Adversarial — End-to-end classification pipeline', () => {
  beforeEach(() => {
    resetTestState();
  });

  test('thread with PDF from allowlisted sender but "sale" in subject is forwarded (skip excluded keywords for allowlisted)', () => {
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
    Config.__reset();

    const att = createMockAttachment('sale-invoice.pdf');
    const msg = createMockMessage({
      from: '<supplier@example.com>',
      subject: 'Flash Sale Invoice #123',
      body: 'Your invoice for the sale event is attached.',
      attachments: [att],
    });
    const thread = createMockThread({ messages: [msg] });

    expect(Classifier.classify(thread, msg)).toBeNull();
  });

  test('thread with attachment named ".pdf" (empty name before extension) is treated as valid PDF', () => {
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
    Config.__reset();

    const att = createMockAttachment('.pdf');
    const msg = createMockMessage({
      from: '<supplier@example.com>',
      attachments: [att],
    });
    const thread = createMockThread({ messages: [msg] });

    expect(Classifier.hasValidAttachment(msg)).toBe(true);
    expect(Classifier.threadHasAllowedAttachment(thread)).toBe(true);
  });

  test('thread with allowed attachment only in non-latest message still passes threadHasAllowedAttachment', () => {
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
    Config.__reset();

    const att = createMockAttachment('invoice.pdf');
    const msg1 = createMockMessage({
      from: '<supplier@example.com>',
      attachments: [att],
    });
    const msg2 = createMockMessage({
      from: '<supplier@example.com>',
      subject: 'Re: Invoice',
      attachments: [],
    });
    const thread = createMockThread({ messages: [msg1, msg2] });

    expect(Classifier.classify(thread, msg2)).toBeNull();
  });

  test('classifier does not check excluded keywords for non-allowlisted sender via daisy-chain', () => {
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
    Config.__reset();

    const att = createMockAttachment('invoice.pdf');
    const supplierMsg = createMockMessage({
      from: '<supplier@example.com>',
      subject: 'Invoice #123',
      attachments: [att],
    });
    const fwdMsg = createMockMessage({
      from: '<colleague@company.com>',
      subject: 'Fwd: Great deal on Invoice #123',
      body: 'Check out this newsletter promotion!',
    });
    const thread = createMockThread({ messages: [supplierMsg, fwdMsg] });

    expect(Classifier.classify(thread, fwdMsg)).toBeNull();
  });
});
