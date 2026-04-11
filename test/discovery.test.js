describe('discoverSuppliers', () => {
  beforeEach(() => {
    resetTestState();
  });

  test('aggregates per-sender data', () => {
    const msg1 = createMockMessage({
      from: '<supplier@a.com>',
      subject: 'Invoice #1',
      date: new Date('2025-01-10'),
      attachments: [],
    });
    const msg2 = createMockMessage({
      from: '<supplier@a.com>',
      subject: 'Invoice #2',
      date: new Date('2025-01-15'),
      attachments: [],
    });
    const msg3 = createMockMessage({
      from: '<other@b.com>',
      subject: 'Receipt',
      date: new Date('2025-01-12'),
      attachments: [],
    });

    const thread = createMockThread({ messages: [msg1, msg2, msg3] });
    mockGmailApp.search.mockReturnValue([thread]);

    const result = discoverSuppliers();

    expect(result).toHaveLength(2);
    const supplierA = result.find(r => r.email === 'supplier@a.com');
    expect(supplierA).toBeDefined();
    expect(supplierA.totalEmails).toBe(2);
    expect(supplierA.subjects).toContain('Invoice #1');
    expect(supplierA.subjects).toContain('Invoice #2');
  });

  test('counts PDF attachments per sender', () => {
    const pdfAtt = createMockAttachment('invoice.pdf');
    const msg1 = createMockMessage({
      from: '<supplier@a.com>',
      subject: 'Invoice',
      attachments: [pdfAtt],
    });
    const msg2 = createMockMessage({
      from: '<supplier@a.com>',
      subject: 'Reminder',
      attachments: [],
    });

    const thread = createMockThread({ messages: [msg1, msg2] });
    mockGmailApp.search.mockReturnValue([thread]);

    const result = discoverSuppliers();
    const supplierA = result.find(r => r.email === 'supplier@a.com');
    expect(supplierA.withPdf).toBe(1);
  });

  test('tracks firstSeen and lastSeen dates', () => {
    const msg1 = createMockMessage({
      from: '<supplier@a.com>',
      subject: 'First',
      date: new Date('2025-01-01'),
      attachments: [],
    });
    const msg2 = createMockMessage({
      from: '<supplier@a.com>',
      subject: 'Last',
      date: new Date('2025-06-15'),
      attachments: [],
    });

    const thread = createMockThread({ messages: [msg1, msg2] });
    mockGmailApp.search.mockReturnValue([thread]);

    const result = discoverSuppliers();
    const supplierA = result.find(r => r.email === 'supplier@a.com');
    expect(supplierA.firstSeen.toISOString().slice(0, 10)).toBe('2025-01-01');
    expect(supplierA.lastSeen.toISOString().slice(0, 10)).toBe('2025-06-15');
  });

  test('updates firstSeen when newer date appears first', () => {
    const msgLater = createMockMessage({
      from: '<supplier@a.com>',
      subject: 'Later',
      date: new Date('2025-06-15'),
      attachments: [],
    });
    const msgEarlier = createMockMessage({
      from: '<supplier@a.com>',
      subject: 'Earlier',
      date: new Date('2025-01-01'),
      attachments: [],
    });

    const thread = createMockThread({ messages: [msgLater, msgEarlier] });
    mockGmailApp.search.mockReturnValue([thread]);

    const result = discoverSuppliers();
    const supplierA = result.find(r => r.email === 'supplier@a.com');
    expect(supplierA.firstSeen.toISOString().slice(0, 10)).toBe('2025-01-01');
    expect(supplierA.lastSeen.toISOString().slice(0, 10)).toBe('2025-06-15');
  });

  test('collects up to 3 sample subjects', () => {
    const msgs = Array.from({ length: 5 }, (_, i) =>
      createMockMessage({
        from: '<supplier@a.com>',
        subject: `Email ${i + 1}`,
        attachments: [],
      })
    );
    const thread = createMockThread({ messages: msgs });
    mockGmailApp.search.mockReturnValue([thread]);

    const result = discoverSuppliers();
    const supplierA = result.find(r => r.email === 'supplier@a.com');
    expect(supplierA.subjects).toHaveLength(3);
  });

  test('sorts by totalEmails descending', () => {
    const thread1 = createMockThread({
      messages: [
        createMockMessage({ from: '<rare@z.com>', subject: 'A', attachments: [] }),
      ],
    });
    const thread2 = createMockThread({
      messages: [
        createMockMessage({ from: '<frequent@a.com>', subject: 'B', attachments: [] }),
        createMockMessage({ from: '<frequent@a.com>', subject: 'C', attachments: [] }),
      ],
    });
    mockGmailApp.search.mockReturnValue([thread1, thread2]);

    const result = discoverSuppliers();
    expect(result[0].email).toBe('frequent@a.com');
    expect(result[1].email).toBe('rare@z.com');
  });

  test('tracks keyword matches per sender', () => {
    const msg = createMockMessage({
      from: '<supplier@a.com>',
      subject: 'Your invoice for January',
      attachments: [],
    });
    const thread = createMockThread({ messages: [msg] });
    mockGmailApp.search.mockReturnValue([thread]);

    const result = discoverSuppliers();
    const supplierA = result.find(r => r.email === 'supplier@a.com');
    expect(supplierA.keywords).toHaveProperty('invoice');
  });

  test('returns empty array when no threads found', () => {
    mockGmailApp.search.mockReturnValue([]);

    const result = discoverSuppliers();
    expect(result).toHaveLength(0);
  });

  test('logs discovery summary', () => {
    mockGmailApp.search.mockReturnValue([]);

    discoverSuppliers();

    const entries = Log.getEntries();
    const infoEntries = entries.filter(e => e.type === 'INFO');
    expect(infoEntries.length).toBeGreaterThan(0);
  });
});
