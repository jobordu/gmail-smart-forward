describe('Config', () => {
  beforeEach(() => {
    resetTestState();
  });

  describe('_get', () => {
    test('returns value when set', () => {
      mockPropsStore.FORWARD_TO_EMAIL = 'test@example.com';
      expect(Config.getForwardToEmail()).toBe('test@example.com');
    });

    test('returns default when key is undefined', () => {
      delete mockPropsStore.FORWARD_TO_EMAIL;
      expect(() => Config.getForwardToEmail()).toThrow('Script Property FORWARD_TO_EMAIL is required.');
    });

    test('returns default when value is empty string', () => {
      mockPropsStore.FORWARD_TO_EMAIL = '';
      expect(() => Config.getForwardToEmail()).toThrow('Script Property FORWARD_TO_EMAIL is required.');
    });
  });

  describe('_getList', () => {
    test('parses comma-separated values', () => {
      mockPropsStore.ALLOWED_SENDERS = 'a@b.com, c@d.com, e@f.com';
      expect(Config.getAllowedSenders()).toEqual(['a@b.com', 'c@d.com', 'e@f.com']);
    });

    test('trims and lowercases values', () => {
      mockPropsStore.ALLOWED_SENDERS = ' A@B.COM , C@D.Com ';
      expect(Config.getAllowedSenders()).toEqual(['a@b.com', 'c@d.com']);
    });

    test('filters empty strings', () => {
      mockPropsStore.ALLOWED_SENDERS = 'a@b.com,,c@d.com,';
      expect(Config.getAllowedSenders()).toEqual(['a@b.com', 'c@d.com']);
    });

    test('returns default list when not set', () => {
      mockPropsStore.ALLOWED_SENDERS = '';
      expect(Config.getAllowedSenders()).toEqual([]);
    });

    test('returns empty array when no default provided and key not set', () => {
      delete mockPropsStore.NONEXISTENT_KEY;
      Config.__reset();
      const result = mockPropsStore.NONEXISTENT_KEY;
      expect(result).toBeUndefined();
    });

    test('returns default excluded keywords when not set', () => {
      delete mockPropsStore.EXCLUDED_KEYWORDS;
      Config.__reset();
      expect(Config.getExcludedKeywords()).toEqual(DEFAULT_EXCLUDED_KEYWORDS);
    });
  });

  describe('_getBool', () => {
    test('returns true when value is "true"', () => {
      mockPropsStore.DRY_RUN = 'true';
      expect(Config.isDryRun()).toBe(true);
    });

    test('returns false when value is "false"', () => {
      mockPropsStore.DRY_RUN = 'false';
      expect(Config.isDryRun()).toBe(false);
    });

    test('returns false when value is not "true"', () => {
      mockPropsStore.DRY_RUN = 'yes';
      expect(Config.isDryRun()).toBe(false);
    });

    test('returns default when key is missing', () => {
      delete mockPropsStore.ENABLE_LIVE_FORWARDING;
      Config.__reset();
      expect(Config.isLiveForwardingEnabled()).toBe(false);
    });
  });

  describe('_getInt', () => {
    test('parses integer from string', () => {
      mockPropsStore.MAX_EMAILS_PER_RUN = '25';
      expect(Config.getMaxEmailsPerRun()).toBe(25);
    });

    test('returns default for NaN', () => {
      mockPropsStore.MAX_EMAILS_PER_RUN = 'abc';
      expect(Config.getMaxEmailsPerRun()).toBe(DEFAULT_MAX_EMAILS_PER_RUN);
    });

    test('returns default when not set', () => {
      delete mockPropsStore.DISCOVERY_DAYS;
      Config.__reset();
      expect(Config.getDiscoveryDays()).toBe(DEFAULT_DISCOVERY_DAYS);
    });
  });

  describe('label getters', () => {
    test('returns default label names when not configured', () => {
      expect(Config.getCandidateLabel()).toBe(LABEL_NAMES.CANDIDATE);
      expect(Config.getForwardedLabel()).toBe(LABEL_NAMES.FORWARDED);
      expect(Config.getRejectedLabel()).toBe(LABEL_NAMES.REJECTED);
      expect(Config.getDiscoveredLabel()).toBe(LABEL_NAMES.DISCOVERED);
    });

    test('returns configured label names', () => {
      mockPropsStore.CANDIDATE_LABEL = 'custom/candidate';
      Config.__reset();
      expect(Config.getCandidateLabel()).toBe('custom/candidate');
    });
  });

  describe('keyword getters', () => {
    test('returns defaults when not configured', () => {
      expect(Config.getSubjectKeywords()).toEqual(DEFAULT_SUBJECT_KEYWORDS);
      expect(Config.getAttachmentKeywords()).toEqual(DEFAULT_ATTACHMENT_KEYWORDS);
    });

    test('returns configured keywords', () => {
      mockPropsStore.SUBJECT_KEYWORDS = 'custom1, custom2';
      Config.__reset();
      expect(Config.getSubjectKeywords()).toEqual(['custom1', 'custom2']);
    });
  });

  describe('attachment extensions', () => {
    test('returns default pdf when not configured', () => {
      expect(Config.getAttachmentExtensions()).toEqual(['pdf']);
    });

    test('returns configured extensions', () => {
      mockPropsStore.ATTACHMENT_EXTENSIONS = 'pdf,xml,zip';
      Config.__reset();
      expect(Config.getAttachmentExtensions()).toEqual(['pdf', 'xml', 'zip']);
    });
  });

  describe('LLM config', () => {
    test('returns default LLM config', () => {
      delete mockPropsStore.LLM_MODEL;
      delete mockPropsStore.LLM_BASE_URL;
      delete mockPropsStore.LLM_CONFIDENCE_THRESHOLD;
      delete mockPropsStore.LLM_API_KEY;
      delete mockPropsStore.ENABLE_LLM_CLASSIFICATION;
      Config.__reset();
      expect(Config.getLlmApiKey()).toBeNull();
      expect(Config.getLlmModel()).toBe('google/gemma-4-31b-it');
      expect(Config.getLlmBaseUrl()).toBe('https://api.together.xyz/v1');
      expect(Config.getLlmConfidenceThreshold()).toBe(0.7);
      expect(Config.isLlmEnabled()).toBe(false);
    });

    test('parses confidence threshold', () => {
      mockPropsStore.LLM_CONFIDENCE_THRESHOLD = '0.85';
      Config.__reset();
      expect(Config.getLlmConfidenceThreshold()).toBe(0.85);
    });

    test('returns 0.7 for invalid threshold', () => {
      mockPropsStore.LLM_CONFIDENCE_THRESHOLD = 'not-a-number';
      Config.__reset();
      expect(Config.getLlmConfidenceThreshold()).toBe(0.7);
    });
  });

  describe('operational config', () => {
    test('getBackfillAfterDate returns null when not set', () => {
      mockPropsStore.BACKFILL_AFTER_DATE = '';
      Config.__reset();
      expect(Config.getBackfillAfterDate()).toBeNull();
    });

    test('getBackfillAfterDate returns date when set', () => {
      mockPropsStore.BACKFILL_AFTER_DATE = '2025/01/01';
      Config.__reset();
      expect(Config.getBackfillAfterDate()).toBe('2025/01/01');
    });
  });

  describe('dump', () => {
    test('returns config object', () => {
      const dump = Config.dump();
      expect(dump).toHaveProperty('forwardToEmail');
      expect(dump).toHaveProperty('allowedSenders');
      expect(dump).toHaveProperty('dryRun');
      expect(dump).toHaveProperty('maxEmailsPerRun');
      expect(dump).toHaveProperty('discoveryDays');
    });
  });

  describe('getForwardToEmail', () => {
    test('throws when FORWARD_TO_EMAIL not set', () => {
      delete mockPropsStore.FORWARD_TO_EMAIL;
      Config.__reset();
      expect(() => Config.getForwardToEmail()).toThrow('Script Property FORWARD_TO_EMAIL is required.');
    });

    test('returns email when set', () => {
      mockPropsStore.FORWARD_TO_EMAIL = 'user@example.com';
      Config.__reset();
      expect(Config.getForwardToEmail()).toBe('user@example.com');
    });
  });

  describe('allowlist/denylist', () => {
    test('getAllowedDomains returns configured domains', () => {
      mockPropsStore.ALLOWED_DOMAINS = 'example.com, test.org';
      Config.__reset();
      expect(Config.getAllowedDomains()).toEqual(['example.com', 'test.org']);
    });

    test('getExcludedSenders returns configured senders', () => {
      mockPropsStore.EXCLUDED_SENDERS = 'spam@bad.com';
      Config.__reset();
      expect(Config.getExcludedSenders()).toEqual(['spam@bad.com']);
    });

    test('getExcludedDomains returns configured domains', () => {
      mockPropsStore.EXCLUDED_DOMAINS = 'bad.com';
      Config.__reset();
      expect(Config.getExcludedDomains()).toEqual(['bad.com']);
    });
  });
});
