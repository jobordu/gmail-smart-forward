describe('Log', () => {
  beforeEach(() => {
    resetTestState();
  });

  test('forwarded creates FORWARDED entry', () => {
    const message = createMockMessage({ from: 'from@test.com', subject: 'Test' });
    const thread = createMockThread({ id: 't1' });

    const entry = Log.forwarded(message, thread);

    expect(entry.type).toBe('FORWARDED');
    expect(entry.to).toBe('test@target.com');
    expect(entry.from).toBe('from@test.com');
    expect(entry.subject).toBe('Test');
    expect(entry.threadId).toBe('t1');
    expect(entry.dryRun).toBe(true);
    expect(entry.ts).toBeDefined();
    expect(Log.getEntries()).toHaveLength(1);
  });

  test('rejected creates REJECTED entry', () => {
    const message = createMockMessage({ from: 'from@test.com', subject: 'Test' });
    const thread = createMockThread({ id: 't1' });

    const entry = Log.rejected(message, thread, 'excluded-sender');

    expect(entry.type).toBe('REJECTED');
    expect(entry.reason).toBe('excluded-sender');
    expect(entry.from).toBe('from@test.com');
    expect(entry.threadId).toBe('t1');
  });

  test('discovered creates DISCOVERED entry', () => {
    const data = { email: 'supplier@test.com', totalEmails: 5 };
    const entry = Log.discovered(data);

    expect(entry.type).toBe('DISCOVERED');
    expect(entry.email).toBe('supplier@test.com');
    expect(entry.totalEmails).toBe(5);
  });

  test('info creates INFO entry', () => {
    const entry = Log.info('test message', { key: 'value' });

    expect(entry.type).toBe('INFO');
    expect(entry.msg).toBe('test message');
    expect(entry.key).toBe('value');
  });

  test('info without data creates INFO entry with just msg', () => {
    const entry = Log.info('just a message');
    expect(entry.type).toBe('INFO');
    expect(entry.msg).toBe('just a message');
  });

  test('error creates ERROR entry', () => {
    const entry = Log.error('something failed', new Error('bad'));

    expect(entry.type).toBe('ERROR');
    expect(entry.msg).toBe('something failed');
    expect(entry.error).toContain('bad');
  });

  test('printSummary outputs counts', () => {
    const message = createMockMessage();
    const thread = createMockThread();

    Log.forwarded(message, thread);
    Log.rejected(message, thread, 'test-reason');
    Log.discovered({ email: 'x@y.com' });

    Log.printSummary();

    expect(Logger.log).toHaveBeenCalled();
    const logCalls = Logger.log.mock.calls.map(c => c[0]);
    expect(logCalls).toContain('=== RUN SUMMARY ===');
  });

  test('printSummary shows rejection reasons when rejected > 0', () => {
    const msg = createMockMessage();
    const thread = createMockThread();

    Log.rejected(msg, thread, 'reason-a');
    Log.rejected(msg, thread, 'reason-b');
    Log.rejected(msg, thread, 'reason-a');

    Log.printSummary();

    const logCalls = Logger.log.mock.calls.map(c => c[0]);
    expect(logCalls).toContain('Rejection reasons: {"reason-a":2,"reason-b":1}');
  });

  test('printSummary does not show rejection reasons when none rejected', () => {
    Log.printSummary();

    const logCalls = Logger.log.mock.calls.map(c => c[0]);
    const reasonsLine = logCalls.find(l => l && l.includes('Rejection reasons'));
    expect(reasonsLine).toBeUndefined();
  });

  test('getEntries returns a copy', () => {
    Log.info('test');
    const entries = Log.getEntries();
    expect(entries).toHaveLength(1);
    entries.push({ type: 'FAKE' });
    expect(Log.getEntries()).toHaveLength(1);
  });

  test('__reset clears entries', () => {
    Log.info('test');
    expect(Log.getEntries()).toHaveLength(1);
    Log.__reset();
    expect(Log.getEntries()).toHaveLength(0);
  });

  test('printSummary marks DRY RUN when dry run is active', () => {
    const msg = createMockMessage();
    const thread = createMockThread();
    Log.forwarded(msg, thread);

    Log.printSummary();

    const logCalls = Logger.log.mock.calls.map(c => c[0]);
    expect(logCalls).toContain('Forwarded: 1 (DRY RUN)');
  });

  test('printSummary does not mark DRY RUN when not dry run', () => {
    mockPropsStore.DRY_RUN = 'false';
    Config.__reset();
    Log.__reset();

    const msg = createMockMessage();
    const thread = createMockThread();
    Log.forwarded(msg, thread);

    Log.printSummary();

    const logCalls = Logger.log.mock.calls.map(c => c[0]);
    expect(logCalls).toContain('Forwarded: 1');
  });
});
