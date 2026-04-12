const mockPropsStore = {};

const mockScriptProperties = {
  getProperties: jest.fn(() => mockPropsStore),
  setProperties: jest.fn((props) => Object.assign(mockPropsStore, props)),
  getProperty: jest.fn((key) => mockPropsStore[key]),
  setProperty: jest.fn((key, val) => { mockPropsStore[key] = val; }),
};

const mockLabelsRegistry = {};

const mockGmailApp = {
  getUserLabelByName: jest.fn((name) => mockLabelsRegistry[name] || null),
  createLabel: jest.fn((name) => {
    mockLabelsRegistry[name] = { getName: jest.fn(() => name), getThreads: jest.fn(() => []) };
    return mockLabelsRegistry[name];
  }),
  search: jest.fn(() => []),
};

const mockLoggerLogs = [];
const mockLogger = {
  log: jest.fn((msg) => mockLoggerLogs.push(msg)),
};

const mockHttpResponse = {
  getResponseCode: jest.fn(() => 200),
  getContentText: jest.fn(() => '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'),
};

const mockUrlFetchApp = {
  fetch: jest.fn(() => mockHttpResponse),
};

const mockUtilities = {
  base64Encode: jest.fn((bytes) => Buffer.from(bytes).toString('base64')),
  newBlob: jest.fn(),
};

const mockDocBody = {
  getText: jest.fn(() => 'Invoice #INV-2025-0042\nDate: 2025-04-11\nBill To: Acme Corp\nAmount Due: EUR 1,250.00\nPayment Terms: Net 30'),
};

const mockDoc = {
  getId: jest.fn(() => 'temp-doc-id-123'),
  getBody: jest.fn(() => mockDocBody),
};

const mockDriveFile = {
  setTrashed: jest.fn(),
};

const mockDocumentApp = {
  openById: jest.fn(() => mockDoc),
};

const mockDriveApp = {
  createFile: jest.fn(() => ({ getId: jest.fn(() => 'temp-drive-id-123'), setTrashed: jest.fn() })),
  getFileById: jest.fn(() => mockDriveFile),
};

const mockTriggerList = [];
const mockTriggerBuilder = {
  timeBased: jest.fn(function() { return this; }),
  everyMinutes: jest.fn(function() { return this; }),
  create: jest.fn(function() {
    const trigger = { getHandlerFunction: jest.fn(() => 'processLiveEmails') };
    mockTriggerList.push(trigger);
    return trigger;
  }),
};

const mockScriptApp = {
  getProjectTriggers: jest.fn(() => mockTriggerList.slice()),
  newTrigger: jest.fn(() => mockTriggerBuilder),
  deleteTrigger: jest.fn((trigger) => {
    const idx = mockTriggerList.indexOf(trigger);
    if (idx !== -1) mockTriggerList.splice(idx, 1);
  }),
};

global.PropertiesService = {
  getScriptProperties: jest.fn(() => mockScriptProperties),
};

global.GmailApp = mockGmailApp;
global.Logger = mockLogger;
global.UrlFetchApp = mockUrlFetchApp;
global.Utilities = mockUtilities;
global.ScriptApp = mockScriptApp;
global.DocumentApp = mockDocumentApp;
global.DriveApp = mockDriveApp;

Object.assign(global, {
  mockPropsStore,
  mockScriptProperties,
  mockLabelsRegistry,
  mockGmailApp,
  mockLoggerLogs,
  mockHttpResponse,
  mockUrlFetchApp,
  mockUtilities,
  mockDocBody,
  mockDoc,
  mockDriveFile,
  mockDocumentApp,
  mockDriveApp,
  mockTriggerList,
  mockTriggerBuilder,
  mockScriptApp,
});

function createMockLabel(name) {
  return {
    getName: jest.fn(() => name),
    getThreads: jest.fn(() => []),
  };
}

function createMockAttachment(name, content) {
  var blob = {
    setContentType: jest.fn(function() { return this; }),
    getContentType: jest.fn(() => 'application/pdf'),
  };
  return {
    getName: jest.fn(() => name),
    getBytes: jest.fn(() => content || Buffer.from('pdf-content')),
    getContentType: jest.fn(() => 'application/pdf'),
    copyBlob: jest.fn(() => blob),
  };
}

function createMockMessage(options) {
  options = options || {};
  return {
    getFrom: jest.fn(() => options.from || 'Sender <sender@example.com>'),
    getSubject: jest.fn(() => options.subject || 'Test Subject'),
    getPlainBody: jest.fn(() => options.body || 'Test body'),
    getDate: jest.fn(() => options.date || new Date('2025-01-15')),
    getAttachments: jest.fn(() => options.attachments || []),
    forward: jest.fn(),
    getId: jest.fn(() => options.id || 'msg123'),
  };
}

function createMockThread(options) {
  options = options || {};
  const messages = options.messages || [createMockMessage(options)];
  const threadLabels = (options.labels || []).slice();
  const thread = {
    getId: jest.fn(() => options.id || 'thread123'),
    getMessages: jest.fn(() => messages),
    getLabels: jest.fn(() => threadLabels),
    addLabel: jest.fn(function(label) {
      if (!threadLabels.find(l => l.getName() === label.getName())) {
        threadLabels.push(label);
      }
      return thread;
    }),
    removeLabel: jest.fn(function(label) {
      const idx = threadLabels.findIndex(l => l.getName() === label.getName());
      if (idx !== -1) threadLabels.splice(idx, 1);
      return thread;
    }),
  };
  return thread;
}

global.createMockLabel = createMockLabel;
global.createMockAttachment = createMockAttachment;
global.createMockMessage = createMockMessage;
global.createMockThread = createMockThread;

const defaultTestProps = {
  FORWARD_TO_EMAIL: 'test@target.com',
  ALLOWED_SENDERS: 'supplier@example.com',
  ALLOWED_DOMAINS: 'allowed-domain.com',
  EXCLUDED_SENDERS: '',
  EXCLUDED_DOMAINS: '',
  EXCLUDED_KEYWORDS: '',
  SUBJECT_KEYWORDS: '',
  ATTACHMENT_FILENAME_KEYWORDS: '',
  ATTACHMENT_EXTENSIONS: 'pdf',
  DISCOVERY_DAYS: '30',
  DRY_RUN: 'true',
  MAX_EMAILS_PER_RUN: '10',
  ENABLE_LIVE_FORWARDING: 'false',
  ENABLE_LLM_CLASSIFICATION: 'false',
  LLM_API_KEY: '',
  LLM_BASE_URL: 'https://api.together.xyz/v1',
  LLM_MODEL: 'test-model',
  LLM_CONFIDENCE_THRESHOLD: '0.7',
  BACKFILL_AFTER_DATE: '',
};

function resetTestState(overrides) {
  Object.keys(mockPropsStore).forEach(k => delete mockPropsStore[k]);
  Object.assign(mockPropsStore, defaultTestProps, overrides || {});

  Object.keys(mockLabelsRegistry).forEach(k => delete mockLabelsRegistry[k]);

  mockLoggerLogs.length = 0;
  mockTriggerList.length = 0;

  mockHttpResponse.getResponseCode.mockReturnValue(200);
  mockHttpResponse.getContentText.mockReturnValue('{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}');
  mockUrlFetchApp.fetch.mockReturnValue(mockHttpResponse);

  mockGmailApp.search.mockReturnValue([]);
  mockGmailApp.getUserLabelByName.mockImplementation((name) => mockLabelsRegistry[name] || null);
  mockGmailApp.createLabel.mockImplementation((name) => {
    mockLabelsRegistry[name] = createMockLabel(name);
    return mockLabelsRegistry[name];
  });

  mockDocBody.getText.mockReturnValue('Invoice #INV-2025-0042\nDate: 2025-04-11\nAmount Due: EUR 1,250.00');
  mockDriveApp.createFile.mockReturnValue({ getId: jest.fn(() => 'temp-drive-id-123'), setTrashed: jest.fn() });
  mockDriveApp.getFileById.mockReturnValue(mockDriveFile);

  jest.clearAllMocks();

  if (typeof Config !== 'undefined' && Config.__reset) Config.__reset();
  if (typeof Log !== 'undefined' && Log.__reset) Log.__reset();
  if (typeof Labels !== 'undefined' && Labels.__reset) Labels.__reset();
}

global.resetTestState = resetTestState;
global.defaultTestProps = defaultTestProps;
