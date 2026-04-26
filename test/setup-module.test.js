describe('setup', () => {
  beforeEach(() => {
    resetTestState();
  });

  describe('bootstrapProperties', () => {
    test('throws when _ENV is not defined', () => {
      expect(() => bootstrapProperties()).toThrow('_ENV is not defined');
    });

    test('sets script properties from _ENV', () => {
      global._ENV = { FORWARD_TO_EMAIL: 'test@example.com', DRY_RUN: 'true' };

      bootstrapProperties();

      expect(mockScriptProperties.setProperties).toHaveBeenCalledWith({
        FORWARD_TO_EMAIL: 'test@example.com',
        DRY_RUN: 'true',
      });

      delete global._ENV;
    });

    test('filters out empty string values', () => {
      global._ENV = { FORWARD_TO_EMAIL: 'test@example.com', ALLOWED_DOMAINS: '' };

      bootstrapProperties();

      const setCall = mockScriptProperties.setProperties.mock.calls[0][0];
      expect(setCall).not.toHaveProperty('ALLOWED_DOMAINS');
      expect(setCall).toHaveProperty('FORWARD_TO_EMAIL');

      delete global._ENV;
    });
  });

  describe('setupAll', () => {
    test('validates config and creates labels', () => {
      setupAll();

      expect(mockGmailApp.createLabel).toHaveBeenCalled();
    });
  });

  describe('setupLabels', () => {
    test('creates all required labels', () => {
      setupLabels();

      expect(mockGmailApp.createLabel).toHaveBeenCalledWith('gmail-smart-forward/candidate');
      expect(mockGmailApp.createLabel).toHaveBeenCalledWith('gmail-smart-forward/forwarded');
      expect(mockGmailApp.createLabel).toHaveBeenCalledWith('gmail-smart-forward/rejected');
      expect(mockGmailApp.createLabel).toHaveBeenCalledWith('gmail-smart-forward/discovered');
    });
  });

  describe('setupTrigger', () => {
    test('creates a trigger when none exists', () => {
      setupTrigger();

      expect(mockScriptApp.newTrigger).toHaveBeenCalledWith('processLiveEmails');
      expect(mockTriggerBuilder.timeBased).toHaveBeenCalled();
      expect(mockTriggerBuilder.everyMinutes).toHaveBeenCalledWith(15);
      expect(mockTriggerBuilder.create).toHaveBeenCalled();
    });

    test('skips creating trigger when one already exists', () => {
      const existingTrigger = { getHandlerFunction: jest.fn(() => 'processLiveEmails') };
      mockTriggerList.push(existingTrigger);

      setupTrigger();

      expect(mockScriptApp.newTrigger).not.toHaveBeenCalled();
    });

    test('creates trigger when existing trigger has different handler', () => {
      const otherTrigger = { getHandlerFunction: jest.fn(() => 'otherFunction') };
      mockTriggerList.push(otherTrigger);

      setupTrigger();

      expect(mockScriptApp.newTrigger).toHaveBeenCalledWith('processLiveEmails');
    });
  });

  describe('removeTrigger', () => {
    test('removes all processLiveEmails triggers', () => {
      const trigger1 = { getHandlerFunction: jest.fn(() => 'processLiveEmails') };
      const trigger2 = { getHandlerFunction: jest.fn(() => 'otherFunction') };
      mockTriggerList.push(trigger1, trigger2);

      removeTrigger();

      expect(mockScriptApp.deleteTrigger).toHaveBeenCalledWith(trigger1);
      expect(mockScriptApp.deleteTrigger).not.toHaveBeenCalledWith(trigger2);
    });

    test('BUG: removeTrigger crashes when getProjectTriggers returns null (unlike setupTrigger which guards against it)', () => {
      // setupTrigger has an explicit null guard: if (!triggers) { ... return; }
      // removeTrigger does NOT have this guard. If ScriptApp.getProjectTriggers()
      // returns null (which can happen in some GAS environments), removeTrigger
      // will crash with "Cannot read properties of null (reading 'length')".
      const original = global.ScriptApp;
      global.ScriptApp = { ...original, getProjectTriggers: jest.fn(() => null) };

      try {
        expect(() => removeTrigger()).not.toThrow();
      } finally {
        global.ScriptApp = original;
      }
    });
  });

  describe('validateConfig', () => {
    test('returns no errors or warnings with valid config', () => {
      const result = validateConfig();

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('Config looks good.');
    });

    test('returns error when FORWARD_TO_EMAIL is not set', () => {
      delete mockPropsStore.FORWARD_TO_EMAIL;
      Config.__reset();

      const result = validateConfig();

      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('FORWARD_TO_EMAIL')])
      );
    });

    test('returns error for invalid email format', () => {
      mockPropsStore.FORWARD_TO_EMAIL = 'not-an-email';
      Config.__reset();

      const result = validateConfig();

      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('does not look like a valid email')])
      );
    });

    test('returns warning when no allowlist configured', () => {
      mockPropsStore.ALLOWED_SENDERS = '';
      mockPropsStore.ALLOWED_DOMAINS = '';
      Config.__reset();

      const result = validateConfig();

      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('No ALLOWED_SENDERS')])
      );
    });

    test('returns error when sender is in both allowlist and denylist', () => {
      mockPropsStore.ALLOWED_SENDERS = 'foo@bar.com';
      mockPropsStore.EXCLUDED_SENDERS = 'foo@bar.com';
      Config.__reset();

      const result = validateConfig();

      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('both ALLOWED_SENDERS and EXCLUDED_SENDERS')])
      );
    });

    test('returns error when domain is in both allowlist and denylist', () => {
      mockPropsStore.ALLOWED_DOMAINS = 'example.com';
      mockPropsStore.EXCLUDED_DOMAINS = 'example.com';
      Config.__reset();

      const result = validateConfig();

      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('both ALLOWED_DOMAINS and EXCLUDED_DOMAINS')])
      );
    });

    test('returns error when ATTACHMENT_EXTENSIONS is explicitly empty', () => {
      mockPropsStore.ATTACHMENT_EXTENSIONS = '';
      Config.__reset();

      const result = validateConfig();

      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('ATTACHMENT_EXTENSIONS')])
      );
    });

    test('returns warning for dot-prefixed extension', () => {
      mockPropsStore.ATTACHMENT_EXTENSIONS = '.pdf';
      Config.__reset();

      const result = validateConfig();

      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('dot prefix')])
      );
    });

    test('returns error when live forwarding enabled without allowlist', () => {
      mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
      mockPropsStore.ALLOWED_SENDERS = '';
      mockPropsStore.ALLOWED_DOMAINS = '';
      Config.__reset();

      const result = validateConfig();

      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('no allowlist is configured')])
      );
    });

    test('returns error when LLM enabled without API key', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = '';
      Config.__reset();

      const result = validateConfig();

      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('LLM_API_KEY')])
      );
    });

    test('returns error for out-of-range confidence threshold', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.LLM_CONFIDENCE_THRESHOLD = '1.5';
      Config.__reset();

      const result = validateConfig();

      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('LLM_CONFIDENCE_THRESHOLD')])
      );
    });

    test('passes with valid LLM config', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      const result = validateConfig();

      expect(result.errors).toEqual(
        expect.not.arrayContaining([expect.stringContaining('LLM')])
      );
    });
  });

  describe('migrateLabels', () => {
    test('skips migration when old label does not exist', () => {
      migrateLabels();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls.some(l => l && l.includes('Skipping'))).toBe(true);
    });

    test('migrates threads from old label to new label', () => {
      const oldLabel = createMockLabel('revolut-forwarded');
      oldLabel.getThreads = jest.fn(() => {
        const thread = createMockThread();
        return [thread];
      });
      mockLabelsRegistry['revolut-forwarded'] = oldLabel;

      migrateLabels();

      expect(mockGmailApp.createLabel).toHaveBeenCalled();
    });

    test('creates new label when it does not exist during migration', () => {
      const oldLabel = createMockLabel('revolut-forwarded');
      oldLabel.getThreads = jest.fn(() => [createMockThread()]);
      mockLabelsRegistry['revolut-forwarded'] = oldLabel;
      delete mockLabelsRegistry['gmail-smart-forward/forwarded'];

      migrateLabels();

      expect(mockGmailApp.createLabel).toHaveBeenCalled();
    });

    test('reuses existing new label during migration', () => {
      const oldLabel = createMockLabel('revolut-rejected');
      oldLabel.getThreads = jest.fn(() => [createMockThread()]);
      mockLabelsRegistry['revolut-rejected'] = oldLabel;

      const existingNewLabel = createMockLabel('gmail-smart-forward/rejected');
      mockLabelsRegistry['gmail-smart-forward/rejected'] = existingNewLabel;

      migrateLabels();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls.some(l => l && l.includes('Migrating'))).toBe(true);
    });
  });

  describe('clearAllLabels', () => {
    test('removes labels from all threads', () => {
      const label = Labels.getForwarded();
      label.getThreads = jest.fn(() => [createMockThread()]);

      clearAllLabels();

      expect(label.getThreads).toHaveBeenCalled();
    });
  });

  describe('testSetup', () => {
    test('runs validation and label setup', () => {
      testSetup();

      expect(mockGmailApp.createLabel).toHaveBeenCalled();
    });
  });

  describe('status', () => {
    test('shows Preview state when dry run is on and live is off', () => {
      mockPropsStore.DRY_RUN = 'true';
      mockPropsStore.ENABLE_LIVE_FORWARDING = 'false';
      Config.__reset();

      status();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('State: Preview (DRY_RUN=true, ENABLE_LIVE_FORWARDING=false)');
    });

    test('shows Backfill state when dry run is off and live is off', () => {
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.ENABLE_LIVE_FORWARDING = 'false';
      Config.__reset();

      status();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('State: Backfill (DRY_RUN=false, ENABLE_LIVE_FORWARDING=false)');
    });

    test('shows Live state when dry run is off and live is on', () => {
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
      Config.__reset();

      status();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('State: Live (DRY_RUN=false, ENABLE_LIVE_FORWARDING=true)');
    });

    test('shows Invalid state when both dry run and live are on', () => {
      mockPropsStore.DRY_RUN = 'true';
      mockPropsStore.ENABLE_LIVE_FORWARDING = 'true';
      Config.__reset();

      status();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls.some(l => l && l.includes('Invalid'))).toBe(true);
    });

    test('shows trigger not installed when no trigger exists', () => {
      mockTriggerList.length = 0;

      status();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('Trigger: Not installed');
    });

    test('shows trigger active when processLiveEmails trigger exists', () => {
      mockTriggerList.push({ getHandlerFunction: jest.fn(() => 'processLiveEmails') });

      status();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('Trigger: Active (processLiveEmails every 15 min)');
    });

    test('shows forward to email', () => {
      mockPropsStore.FORWARD_TO_EMAIL = 'accounting@company.com';
      Config.__reset();

      status();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('Forward to: accounting@company.com');
    });

    test('shows (not set) when forward email is missing', () => {
      delete mockPropsStore.FORWARD_TO_EMAIL;
      Config.__reset();

      status();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('Forward to: (not set)');
    });

    test('shows label thread counts', () => {
      status();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('  Candidate:  0 threads');
      expect(logCalls).toContain('  Forwarded:  0 threads');
      expect(logCalls).toContain('  Rejected:   0 threads');
      expect(logCalls).toContain('  Discovered: 0 threads');
    });

    test('shows LLM disabled by default', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'false';
      Config.__reset();

      status();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('LLM classification: Disabled');
    });

    test('shows LLM enabled with model name', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.LLM_MODEL = 'test-model';
      Config.__reset();

      status();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('LLM classification: Enabled (test-model)');
    });

    test('runs config validation and reports OK', () => {
      status();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('Config validation: OK');
    });

    test('reports validation errors count', () => {
      delete mockPropsStore.FORWARD_TO_EMAIL;
      Config.__reset();

      status();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('Config validation: 1 error(s), 0 warning(s)');
    });
  });
});
