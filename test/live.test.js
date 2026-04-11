describe('processLiveEmails', () => {
  beforeEach(() => {
    resetTestState();
  });

  test('exits immediately when live forwarding is disabled', () => {
    mockPropsStore.ENABLE_LIVE_FORWARDING = 'false';
    Config.__reset();

    processLiveEmails();

    expect(mockGmailApp.search).not.toHaveBeenCalled();
  });

  test('searches for live threads when enabled', () => {
    mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
    Config.__reset();

    mockGmailApp.search.mockReturnValue([]);

    processLiveEmails();

    expect(mockGmailApp.search).toHaveBeenCalled();
  });

  test('forwards qualifying threads in live mode', () => {
    mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
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

    processLiveEmails();

    expect(msg.forward).toHaveBeenCalledWith('test@target.com');
  });

  test('does not forward non-qualifying threads', () => {
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

    expect(msg.forward).not.toHaveBeenCalled();
  });

  test('respects maxEmailsPerRun limit', () => {
    mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
    mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
    mockPropsStore.MAX_EMAILS_PER_RUN = '1';
    Config.__reset();

    const threads = Array.from({ length: 3 }, (_, i) => {
      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      return createMockThread({ messages: [msg], id: `t${i}` });
    });
    mockGmailApp.search.mockReturnValue(threads);

    processLiveEmails();

    const forwarded = threads.filter(t =>
      t.getMessages()[0].forward.mock.calls.length > 0
    );
    expect(forwarded.length).toBeLessThanOrEqual(1);
  });

  test('logs rejected threads', () => {
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

    const entries = Log.getEntries();
    const rejectedEntry = entries.find(e => e.type === 'REJECTED');
    expect(rejectedEntry).toBeDefined();
  });

  test('logs live run info', () => {
    mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
    Config.__reset();

    mockGmailApp.search.mockReturnValue([]);

    processLiveEmails();

    const entries = Log.getEntries();
    const infoEntries = entries.filter(e => e.type === 'INFO');
    expect(infoEntries.some(e => e.msg === 'Live run started')).toBe(true);
    expect(infoEntries.some(e => e.msg === 'Live run done')).toBe(true);
  });
});
