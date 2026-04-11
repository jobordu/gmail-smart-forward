describe('backfill', () => {
  beforeEach(() => {
    resetTestState();
  });

  describe('_shuffle', () => {
    test('returns array of same length', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = _shuffle(arr);
      expect(result).toHaveLength(5);
    });

    test('preserves all elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = _shuffle(arr);
      expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    test('returns same elements (shuffle is in-place)', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = _shuffle(arr);
      expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('dryRunBackfill', () => {
    test('forces dry run mode regardless of config', () => {
      mockPropsStore.DRY_RUN = 'false';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      dryRunBackfill();

      expect(msg.forward).not.toHaveBeenCalled();
    });

    test('does not apply forwarded label in dry run', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      dryRunBackfill();

      expect(thread.addLabel).not.toHaveBeenCalled();
    });
  });

  describe('backfillApprovedSuppliers', () => {
    test('respects config dry run setting', () => {
      mockPropsStore.DRY_RUN = 'true';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      backfillApprovedSuppliers();

      expect(msg.forward).not.toHaveBeenCalled();
    });

    test('forwards qualifying threads in live mode', () => {
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      backfillApprovedSuppliers();

      expect(msg.forward).toHaveBeenCalledWith('test@target.com');
    });

    test('rejects non-qualifying threads', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const msg = createMockMessage({
        from: '<unknown@other.com>',
        attachments: [],
      });
      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      backfillApprovedSuppliers();

      expect(msg.forward).not.toHaveBeenCalled();
    });

    test('respects maxEmailsPerRun limit', () => {
      mockPropsStore.MAX_EMAILS_PER_RUN = '2';
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

      backfillApprovedSuppliers();

      const forwardedCount = threads.filter(t =>
        t.getMessages()[0].forward.mock.calls.length > 0
      ).length;
      expect(forwardedCount).toBeLessThanOrEqual(2);
    });
  });

  describe('_runBackfill', () => {
    test('uses backfillAfterDate from config', () => {
      mockPropsStore.BACKFILL_AFTER_DATE = '2025/01/01';
      Config.__reset();

      mockGmailApp.search.mockReturnValue([]);

      backfillApprovedSuppliers();

      expect(mockGmailApp.search).toHaveBeenCalled();
    });

    test('marks rejected threads with rejection reason', () => {
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const msg = createMockMessage({
        from: '<unknown@other.com>',
        attachments: [],
      });
      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      backfillApprovedSuppliers();

      expect(thread.addLabel).toHaveBeenCalled();
      const addedLabel = thread.addLabel.mock.calls[0][0];
      expect(addedLabel.getName()).toBe('gmail-smart-forward/rejected');
    });
  });

  describe('backfillSender', () => {
    test('searches for emails from specific sender with PDFs', () => {
      mockPropsStore.ALLOWED_SENDERS = 'invoice+statements+acct_1Rh0IhRp8MKof9Wn@stripe.com';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<invoice+statements+acct_1Rh0IhRp8MKof9Wn@stripe.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      backfillSender('invoice+statements+acct_1Rh0IhRp8MKof9Wn@stripe.com');

      expect(mockGmailApp.search).toHaveBeenCalled();
      const query = mockGmailApp.search.mock.calls[0][0];
      expect(query).toContain('from:invoice+statements+acct_1Rh0IhRp8MKof9Wn@stripe.com');
      expect(query).toContain('filename:pdf');
    });

    test('logs and returns when no threads found', () => {
      mockGmailApp.search.mockReturnValue([]);

      backfillSender('nobody@example.com');

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls.some(l => l && l.includes('No threads found'))).toBe(true);
    });

    test('returns early when no email provided', () => {
      backfillSender('');

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls.some(l => l && l.includes('Usage'))).toBe(true);
    });

    test('forwards qualifying threads from specific sender', () => {
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@stripe.com';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@stripe.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });
      mockGmailApp.search.mockReturnValue([thread]);

      backfillSender('supplier@stripe.com');

      expect(msg.forward).toHaveBeenCalledWith('test@target.com');
    });

    test('handles null search results', () => {
      mockGmailApp.search.mockReturnValue(null);

      backfillSender('nobody@example.com');

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls.some(l => l && l.includes('No threads found'))).toBe(true);
    });
  });
});
