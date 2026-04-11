describe('constants', () => {
  test('LABEL_NAMES has all required keys', () => {
    expect(LABEL_NAMES.CANDIDATE).toBe('gmail-smart-forward/candidate');
    expect(LABEL_NAMES.FORWARDED).toBe('gmail-smart-forward/forwarded');
    expect(LABEL_NAMES.REJECTED).toBe('gmail-smart-forward/rejected');
    expect(LABEL_NAMES.DISCOVERED).toBe('gmail-smart-forward/discovered');
  });

  test('DEFAULT_SUBJECT_KEYWORDS is a non-empty array of strings', () => {
    expect(Array.isArray(DEFAULT_SUBJECT_KEYWORDS)).toBe(true);
    expect(DEFAULT_SUBJECT_KEYWORDS.length).toBeGreaterThan(0);
    DEFAULT_SUBJECT_KEYWORDS.forEach(kw => {
      expect(typeof kw).toBe('string');
      expect(kw.length).toBeGreaterThan(0);
    });
  });

  test('DEFAULT_SUBJECT_KEYWORDS contains key invoice terms', () => {
    expect(DEFAULT_SUBJECT_KEYWORDS).toContain('invoice');
    expect(DEFAULT_SUBJECT_KEYWORDS).toContain('receipt');
    expect(DEFAULT_SUBJECT_KEYWORDS).toContain('facture');
    expect(DEFAULT_SUBJECT_KEYWORDS).toContain('factura');
    expect(DEFAULT_SUBJECT_KEYWORDS).toContain('rechnung');
    expect(DEFAULT_SUBJECT_KEYWORDS).toContain('发票');
    expect(DEFAULT_SUBJECT_KEYWORDS).toContain('請求書');
  });

  test('DEFAULT_ATTACHMENT_KEYWORDS is a non-empty array', () => {
    expect(Array.isArray(DEFAULT_ATTACHMENT_KEYWORDS)).toBe(true);
    expect(DEFAULT_ATTACHMENT_KEYWORDS.length).toBeGreaterThan(0);
    expect(DEFAULT_ATTACHMENT_KEYWORDS).toContain('invoice');
    expect(DEFAULT_ATTACHMENT_KEYWORDS).toContain('facture');
    expect(DEFAULT_ATTACHMENT_KEYWORDS).toContain('rechnung');
  });

  test('DEFAULT_EXCLUDED_KEYWORDS is a non-empty array', () => {
    expect(Array.isArray(DEFAULT_EXCLUDED_KEYWORDS)).toBe(true);
    expect(DEFAULT_EXCLUDED_KEYWORDS).toContain('unsubscribe');
    expect(DEFAULT_EXCLUDED_KEYWORDS).toContain('newsletter');
    expect(DEFAULT_EXCLUDED_KEYWORDS).toContain('promotion');
  });

  test('DEFAULT_ATTACHMENT_EXTENSIONS defaults to pdf only', () => {
    expect(DEFAULT_ATTACHMENT_EXTENSIONS).toEqual(['pdf']);
  });

  test('DEFAULT_DISCOVERY_DAYS is 365', () => {
    expect(DEFAULT_DISCOVERY_DAYS).toBe(365);
  });

  test('DEFAULT_MAX_EMAILS_PER_RUN is 50', () => {
    expect(DEFAULT_MAX_EMAILS_PER_RUN).toBe(50);
  });

  test('DEFAULT_DRY_RUN is true', () => {
    expect(DEFAULT_DRY_RUN).toBe(true);
  });
});
