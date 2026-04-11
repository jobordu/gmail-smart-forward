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
  });

  describe('validateConfig', () => {
    test('logs config looks good with valid config', () => {
      validateConfig();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls).toContain('Config looks good.');
    });

    test('logs warnings when FORWARD_TO_EMAIL is not set', () => {
      delete mockPropsStore.FORWARD_TO_EMAIL;
      Config.__reset();

      validateConfig();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls.some(l => l && l.includes('FORWARD_TO_EMAIL'))).toBe(true);
    });

    test('logs warnings when no allowlist configured', () => {
      mockPropsStore.ALLOWED_SENDERS = '';
      mockPropsStore.ALLOWED_DOMAINS = '';
      Config.__reset();

      validateConfig();

      const logCalls = Logger.log.mock.calls.map(c => c[0]);
      expect(logCalls.some(l => l && l.includes('No ALLOWED_SENDERS'))).toBe(true);
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
});
