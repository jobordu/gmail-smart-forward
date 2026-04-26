describe('LlmClassifier', () => {
  beforeEach(() => {
    resetTestState();
  });

  describe('classifyInvoice', () => {
    test('calls API and returns classification result', () => {
      mockPropsStore.ENABLE_LLM_CLASSIFICATION = 'true';
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.92,\\"reason\\":\\"Invoice PDF attached\\"}"}}]}'
      );

      const msg = createMockMessage({
        subject: 'Invoice #123',
        body: 'Please find attached invoice',
      });
      const thread = createMockThread({ messages: [msg] });

      const result = LlmClassifier.classifyInvoice(msg, thread);

      expect(result.is_invoice).toBe(true);
      expect(result.confidence).toBe(0.92);
      expect(result.reason).toBe('Invoice PDF attached');
      expect(UrlFetchApp.fetch).toHaveBeenCalledTimes(1);
    });

    test('includes PDF text content in user message', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      const pdfAttachment = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        subject: 'Your invoice',
        body: 'Please pay this invoice',
        attachments: [pdfAttachment],
      });
      const thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;

      expect(typeof userContent).toBe('string');
      expect(userContent).toContain('Your invoice');
      expect(userContent).toContain('--- PDF attachment content ---');
    });

    test('sends text-only content when no PDF attachment', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":false,\\"confidence\\":0.4,\\"reason\\":\\"no invoice\\"}"}}]}'
      );

      const msg = createMockMessage({
        subject: 'Hello',
        body: 'Just a friendly email',
        attachments: [],
      });
      const thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;

      expect(typeof userContent).toBe('string');
      expect(userContent).not.toContain('--- PDF attachment content ---');
    });

    test('includes correct system prompt', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      const msg = createMockMessage({ subject: 'Test', body: 'Test', attachments: [] });
      const thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      expect(payload.messages[0].role).toBe('system');
      expect(payload.messages[0].content).toContain('invoice detection assistant');
      expect(payload.messages[0].content).toContain('actual boolean and number values');
    });

    test('uses correct API key and model from config', () => {
      mockPropsStore.LLM_API_KEY = 'my-secret-key';
      mockPropsStore.LLM_MODEL = 'custom/model';
      mockPropsStore.LLM_BASE_URL = 'https://custom.api.com/v1';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      const msg = createMockMessage({ subject: 'Test', body: 'Test', attachments: [] });
      const thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      expect(fetchCall[0]).toBe('https://custom.api.com/v1/chat/completions');
      const payload = JSON.parse(fetchCall[1].payload);
      expect(payload.model).toBe('custom/model');
      expect(fetchCall[1].headers.Authorization).toBe('Bearer my-secret-key');
    });

    test('throws on non-200 API response', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(429);
      mockHttpResponse.getContentText.mockReturnValue('Rate limited');

      const msg = createMockMessage({ subject: 'Test', body: 'Test', attachments: [] });
      const thread = createMockThread({ messages: [msg] });

      expect(() => LlmClassifier.classifyInvoice(msg, thread)).toThrow('LLM API returned 429');
    });

    test('truncates body to 3000 characters', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      const longBody = 'x'.repeat(5000);
      const msg = createMockMessage({ subject: 'Test', body: longBody, attachments: [] });
      const thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;
      expect(userContent.length).toBeLessThan(longBody.length + 100);
    });

    test('extracts PDF text from any message in thread', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      const msgNoPdf = createMockMessage({ attachments: [] });
      const pdfAtt = createMockAttachment('receipt.pdf');
      const msgWithPdf = createMockMessage({ attachments: [pdfAtt] });
      const thread = createMockThread({ messages: [msgNoPdf, msgWithPdf] });

      LlmClassifier.classifyInvoice(msgNoPdf, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;

      expect(userContent).toContain('--- PDF attachment content ---');
    });

    test('skips non-PDF attachments', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      const jpgAtt = createMockAttachment('photo.jpg');
      const msg = createMockMessage({ attachments: [jpgAtt] });
      const thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;

      expect(userContent).not.toContain('--- PDF attachment content ---');
    });

    test('finds first PDF attachment skipping non-PDF attachments', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      const jpgAtt = createMockAttachment('preview.jpg');
      const pdfAtt = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({ attachments: [jpgAtt, pdfAtt] });
      const thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;
      expect(userContent).toContain('--- PDF attachment content ---');
    });

    test('uses muteHttpExceptions in fetch options', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      const msg = createMockMessage({ subject: 'Test', body: 'Test', attachments: [] });
      const thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      expect(fetchCall[1].muteHttpExceptions).toBe(true);
    });

    test('sends response_format as json_object', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      const msg = createMockMessage({ subject: 'Test', body: 'Test', attachments: [] });
      const thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      expect(payload.response_format).toEqual({ type: 'json_object' });
    });

    test('falls back to reasoning field when content is empty (thinking models)', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"","reasoning":"I see this is an invoice email. The answer is: {\\"is_invoice\\":true,\\"confidence\\":0.88,\\"reason\\":\\"Invoice detected\\"}"}}]}'
      );

      const msg = createMockMessage({ subject: 'Invoice #123', body: 'Please pay', attachments: [] });
      const thread = createMockThread({ messages: [msg] });

      const result = LlmClassifier.classifyInvoice(msg, thread);

      expect(result.is_invoice).toBe(true);
      expect(result.confidence).toBe(0.88);
      expect(result.reason).toBe('Invoice detected');
    });

    test('falls back to reasoning with nested JSON match', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"","reasoning":"Analysis: This is not an invoice. Final: {\\"is_invoice\\":false,\\"confidence\\":0.6,\\"reason\\":\\"Newsletter\\"}"}}]}'
      );

      const msg = createMockMessage({ subject: 'Newsletter', body: 'Deals!', attachments: [] });
      const thread = createMockThread({ messages: [msg] });

      const result = LlmClassifier.classifyInvoice(msg, thread);

      expect(result.is_invoice).toBe(false);
      expect(result.confidence).toBe(0.6);
    });

    test('throws when both content and reasoning are empty', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"","reasoning":""}}]}'
      );

      const msg = createMockMessage({ subject: 'Test', body: 'Test', attachments: [] });
      const thread = createMockThread({ messages: [msg] });

      expect(() => LlmClassifier.classifyInvoice(msg, thread)).toThrow();
    });

    test('throws when reasoning has no JSON match', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"","reasoning":"This is just text without any JSON."}}]}'
      );

      const msg = createMockMessage({ subject: 'Test', body: 'Test', attachments: [] });
      const thread = createMockThread({ messages: [msg] });

      expect(() => LlmClassifier.classifyInvoice(msg, thread)).toThrow();
    });

    test('prefers content over reasoning when both present', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.95,\\"reason\\":\\"from content\\"}","reasoning":"Some thinking text"}}]}'
      );

      const msg = createMockMessage({ subject: 'Test', body: 'Test', attachments: [] });
      const thread = createMockThread({ messages: [msg] });

      const result = LlmClassifier.classifyInvoice(msg, thread);

      expect(result.is_invoice).toBe(true);
      expect(result.reason).toBe('from content');
    });

    test('tier 1 skipped for PDF, uses raw bytes extraction', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      var pdfAtt = createMockAttachment('invoice.pdf');
      var msg = createMockMessage({
        subject: 'Invoice',
        body: 'Please pay',
        attachments: [pdfAtt],
      });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      expect(mockDriveApp.createFile).not.toHaveBeenCalled();
    });

    test('handles PDF text extraction failure gracefully', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.7,\\"reason\\":\\"test\\"}"}}]}'
      );

      var pdfAtt = createMockAttachment('broken.pdf');
      var msg = createMockMessage({
        subject: 'Invoice',
        body: 'Please pay',
        attachments: [pdfAtt],
      });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      var fetchCall = UrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      var userContent = payload.messages[1].content;

      expect(userContent).toContain('broken.pdf');
    });

    test('tier 1: skips DocumentApp when content type is not a Google Doc', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      var pdfAtt = createMockAttachment('invoice.pdf');
      var pdfBlob = {
        getContentType: jest.fn(() => 'application/pdf'),
        getBytes: jest.fn(() => Buffer.from('stream\n(Invoice total: $200.00 USD)\nendstream')),
        getDataAsString: jest.fn(() => 'stream\n(Invoice total: $200.00 USD)\nendstream'),
      };
      pdfAtt.copyBlob.mockReturnValue(pdfBlob);

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      var msg = createMockMessage({ subject: 'Invoice', body: 'Pay', attachments: [pdfAtt] });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      expect(mockDriveApp.createFile).not.toHaveBeenCalled();
      var fetchCall = UrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      expect(payload.messages[1].content).toContain('Invoice total: $200.00 USD');
    });

    test('tier 1: uses DocumentApp when content type is a Google Doc', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('Invoice from Google Doc: $300');
      mockDriveApp.createFile.mockReturnValue({ getId: jest.fn(() => 'doc-id'), setTrashed: jest.fn() });

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      var docAtt = createMockAttachment('invoice.pdf');
      var docBlob = {
        getContentType: jest.fn(() => 'application/vnd.google-apps.document'),
        getBytes: jest.fn(() => Buffer.from('doc-content')),
        getDataAsString: jest.fn(() => 'doc-content'),
      };
      docAtt.copyBlob.mockReturnValue(docBlob);

      var msg = createMockMessage({ subject: 'Invoice', body: 'Pay', attachments: [docAtt] });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      expect(mockDriveApp.createFile).toHaveBeenCalled();
      var fetchCall = UrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      expect(payload.messages[1].content).toContain('Invoice from Google Doc: $300');
    });

    test('tier 1: DocumentApp succeeds for Google Doc type', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('Invoice total: $500.00');
      mockDriveApp.createFile.mockReturnValue({ getId: jest.fn(() => 'doc-id'), setTrashed: jest.fn() });

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      var docAtt = createMockAttachment('invoice.pdf');
      var docBlob = {
        getContentType: jest.fn(() => 'application/vnd.google-apps.document'),
        getBytes: jest.fn(() => Buffer.from('doc-content')),
        getDataAsString: jest.fn(() => 'doc-content'),
      };
      docAtt.copyBlob.mockReturnValue(docBlob);

      var msg = createMockMessage({ subject: 'Invoice', body: 'Pay', attachments: [docAtt] });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      var fetchCall = UrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      expect(payload.messages[1].content).toContain('Invoice total: $500.00');
    });

    test('tier 2: extracts text from raw PDF bytes', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('');
      mockDriveApp.createFile.mockReturnValue({ getId: jest.fn(() => 'doc-id'), setTrashed: jest.fn() });

      var pdfContent = buildRealisticPdfContent([
        { text: 'Invoice Number: INV-123' },
        { text: 'Total Amount: $99.99' },
      ]);

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      var pdfAtt = createMockAttachment('invoice.pdf', pdfContent);
      var msg = createMockMessage({ subject: 'Invoice', body: 'Pay', attachments: [pdfAtt] });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      var fetchCall = UrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      var userContent = payload.messages[1].content;
      expect(userContent).toContain('Invoice Number: INV-123');
    });

    test('tier 2: extracts hex-encoded text from PDF streams', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('');
      mockDriveApp.createFile.mockReturnValue({ getId: jest.fn(() => 'doc-id'), setTrashed: jest.fn() });

      var hex = Buffer.from('Invoice Date: 2025-01-15', 'utf8').toString('hex').toUpperCase();
      var pdfContent = buildRealisticPdfContent([{ hex: hex }]);

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      var pdfAtt = createMockAttachment('invoice.pdf', pdfContent);
      var msg = createMockMessage({ subject: 'Invoice', body: 'Pay', attachments: [pdfAtt] });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      var fetchCall = UrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      var userContent = payload.messages[1].content;
      expect(userContent).toContain('Invoice Date: 2025-01-15');
    });

    test('tier 2: skips hex content with no recognizable words', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('');
      mockDriveApp.createFile.mockReturnValue({ getId: jest.fn(() => 'doc-id'), setTrashed: jest.fn() });

      var hex = Buffer.from('\x00\x01\x02\x03\x04', 'binary').toString('hex').toUpperCase();
      var pdfContent = buildRealisticPdfContent([{ hex: hex }]);

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.7,\\"reason\\":\\"test\\"}"}}]}'
      );

      var pdfAtt = createMockAttachment('invoice.pdf', pdfContent);
      var msg = createMockMessage({ subject: 'Invoice', body: 'Pay', attachments: [pdfAtt] });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      var fetchCall = UrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      var userContent = payload.messages[1].content;
      expect(userContent).toContain('PDF metadata');
    });

    test('tier 2: skips raw bytes when extracted text is too short', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('');
      mockDriveApp.createFile.mockReturnValue({ getId: jest.fn(() => 'doc-id'), setTrashed: jest.fn() });

      var pdfContent = buildRealisticPdfContent([{ text: 'ab' }]);

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.7,\\"reason\\":\\"test\\"}"}}]}'
      );

      var pdfAtt = createMockAttachment('invoice.pdf', pdfContent);
      var msg = createMockMessage({ subject: 'Invoice', body: 'Pay', attachments: [pdfAtt] });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      var fetchCall = UrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      var userContent = payload.messages[1].content;
      expect(userContent).toContain('PDF metadata');
    });

    test('tier 3: falls back to metadata when both DocumentApp and raw bytes fail', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('');
      mockDriveApp.createFile.mockReturnValue({ getId: jest.fn(() => 'doc-id'), setTrashed: jest.fn() });

      var pdfContent = Buffer.from('not a valid pdf stream at all');
      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.7,\\"reason\\":\\"test\\"}"}}]}'
      );

      var pdfAtt = createMockAttachment('scanned-invoice.pdf', pdfContent);
      var msg = createMockMessage({ subject: 'Invoice', body: 'Pay', attachments: [pdfAtt] });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      var fetchCall = UrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      var userContent = payload.messages[1].content;
      expect(userContent).toContain('Filename: scanned-invoice.pdf');
      expect(userContent).toContain('Size:');
      expect(userContent).toContain('Content-Type:');
    });

    test('tier 3: metadata fallback works when content type is not PDF', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      var pdfAtt = createMockAttachment('invoice.pdf');
      pdfAtt.copyBlob.mockReturnValue({
        getContentType: jest.fn(() => 'application/octet-stream'),
        getBytes: jest.fn(() => Buffer.from('bytes')),
        getDataAsString: jest.fn(() => 'bytes'),
      });

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.7,\\"reason\\":\\"test\\"}"}}]}'
      );

      var msg = createMockMessage({ subject: 'Invoice', body: 'Pay', attachments: [pdfAtt] });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      var fetchCall = UrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      var userContent = payload.messages[1].content;
      expect(userContent).toContain('PDF metadata');
      expect(userContent).toContain('invoice.pdf');
    });

    test('tier 1: DocumentApp failure on Google Doc falls back to raw bytes', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocumentApp.openById.mockImplementationOnce(() => {
        throw new Error('Cannot open document');
      });

      var pdfContent = buildRealisticPdfContent([
        { text: 'Bill To: Customer' },
        { text: 'Amount: 100.00 EUR' },
      ]);

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      var docAtt = createMockAttachment('bill.pdf', pdfContent);
      var docBlob = {
        getContentType: jest.fn(() => 'application/vnd.google-apps.document'),
        getBytes: jest.fn(() => pdfContent),
        getDataAsString: jest.fn(() => pdfContent.toString('utf8')),
      };
      docAtt.copyBlob.mockReturnValue(docBlob);

      var msg = createMockMessage({ subject: 'Bill', body: 'Pay', attachments: [docAtt] });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      var fetchCall = UrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      var userContent = payload.messages[1].content;
      expect(userContent).toContain('Bill To: Customer');
      expect(userContent).toContain('Amount: 100.00 EUR');
    });

    test('tier 2: handles raw bytes extraction exception gracefully', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('');
      mockDriveApp.createFile.mockReturnValue({ getId: jest.fn(() => 'doc-id'), setTrashed: jest.fn() });

      var pdfAtt = createMockAttachment('invoice.pdf');
      var brokenBlob = {
        getContentType: jest.fn(() => 'application/pdf'),
        getBytes: jest.fn(() => Buffer.from('x')),
        getDataAsString: jest.fn(() => { throw new Error('encoding error'); }),
      };
      pdfAtt.copyBlob.mockReturnValue(brokenBlob);

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.7,\\"reason\\":\\"test\\"}"}}]}'
      );

      var msg = createMockMessage({ subject: 'Invoice', body: 'Pay', attachments: [pdfAtt] });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      var fetchCall = UrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      var userContent = payload.messages[1].content;
      expect(userContent).toContain('PDF metadata');
    });

    test('tier 2: extracts text from multiple PDF streams', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('');
      mockDriveApp.createFile.mockReturnValue({ getId: jest.fn(() => 'doc-id'), setTrashed: jest.fn() });

      var pdfContent = buildRealisticPdfContent([
        { text: 'Invoice Number: 42' },
        { text: 'Total: 1000' },
      ]);

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      var pdfAtt = createMockAttachment('invoice.pdf', pdfContent);
      var msg = createMockMessage({ subject: 'Invoice', body: 'Pay', attachments: [pdfAtt] });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      var fetchCall = UrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      var userContent = payload.messages[1].content;
      expect(userContent).toContain('Invoice Number: 42');
      expect(userContent).toContain('Total: 1000');
    });

    test('metadata fallback lists all attachment filenames across thread', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('');
      mockDriveApp.createFile.mockReturnValue({ getId: jest.fn(() => 'doc-id'), setTrashed: jest.fn() });

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.7,\\"reason\\":\\"test\\"}"}}]}'
      );

      const pdfAtt = createMockAttachment('invoice.pdf', Buffer.from('no streams here'));
      const jpgAtt = createMockAttachment('preview.jpg');
      const termsAtt = createMockAttachment('terms-and-conditions.pdf', Buffer.from('no streams'));
      const msg1 = createMockMessage({ attachments: [jpgAtt] });
      const msg2 = createMockMessage({ attachments: [pdfAtt, termsAtt] });
      const thread = createMockThread({ messages: [msg1, msg2] });

      LlmClassifier.classifyInvoice(msg1, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;
      expect(userContent).toContain('Filename: invoice.pdf');
      expect(userContent).toContain('All attachments: preview.jpg, invoice.pdf, terms-and-conditions.pdf');
    });

    test('metadata fallback omits all-attachments list when only one attachment', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('');
      mockDriveApp.createFile.mockReturnValue({ getId: jest.fn(() => 'doc-id'), setTrashed: jest.fn() });

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.7,\\"reason\\":\\"test\\"}"}}]}'
      );

      const pdfAtt = createMockAttachment('invoice.pdf', Buffer.from('no streams'));
      const msg = createMockMessage({ attachments: [pdfAtt] });
      const thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;
      expect(userContent).toContain('Filename: invoice.pdf');
      expect(userContent).not.toContain('All attachments:');
    });

    test('metadata fallback includes filenames from multiple messages', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('');
      mockDriveApp.createFile.mockReturnValue({ getId: jest.fn(() => 'doc-id'), setTrashed: jest.fn() });

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.7,\\"reason\\":\\"test\\"}"}}]}'
      );

      const receiptPdf = createMockAttachment('receipt-march.pdf', Buffer.from('no streams'));
      const msg1 = createMockMessage({ attachments: [createMockAttachment('logo.png')] });
      const msg2 = createMockMessage({ attachments: [receiptPdf, createMockAttachment('details.docx')] });
      const thread = createMockThread({ messages: [msg1, msg2] });

      LlmClassifier.classifyInvoice(msg2, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;
      expect(userContent).toContain('All attachments: logo.png, receipt-march.pdf, details.docx');
    });

    test('tier 1 returns text from first Google Doc even when multiple docs exist', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('Invoice total: $250.00');
      mockDriveApp.createFile.mockReturnValue({ getId: jest.fn(() => 'doc-id'), setTrashed: jest.fn() });

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      var docBlob = {
        getContentType: jest.fn(() => 'application/vnd.google-apps.document'),
        getBytes: jest.fn(() => Buffer.from('doc-content')),
        getDataAsString: jest.fn(() => 'doc-content'),
      };
      var doc1 = createMockAttachment('page-1.pdf');
      doc1.copyBlob.mockReturnValue(docBlob);
      var doc2 = createMockAttachment('page-2.pdf');
      doc2.copyBlob.mockReturnValue(docBlob);

      var msg = createMockMessage({ attachments: [doc1, doc2] });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      var fetchCall = UrlFetchApp.fetch.mock.calls[0];
      var payload = JSON.parse(fetchCall[1].payload);
      expect(payload.messages[1].content).toContain('Invoice total: $250.00');
    });

    test('truncates PDF text to 3000 characters', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('x'.repeat(5000));

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      var docAtt = createMockAttachment('long.pdf');
      var docBlob = {
        getContentType: jest.fn(() => 'application/vnd.google-apps.document'),
        getBytes: jest.fn(() => Buffer.from('doc-content')),
        getDataAsString: jest.fn(() => 'doc-content'),
      };
      docAtt.copyBlob.mockReturnValue(docBlob);

      var msg = createMockMessage({
        subject: 'Test',
        body: 'Test',
        attachments: [docAtt],
      });
      var thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;

      const pdfSection = userContent.split('--- PDF attachment content ---')[1];
      expect(pdfSection.length).toBeLessThanOrEqual(3001);
    });

    test('BUG: trailing slash in LLM_BASE_URL produces double-slash in API endpoint URL', () => {
      // _callApi concatenates baseUrl + '/chat/completions' without stripping
      // trailing slashes. If a user configures LLM_BASE_URL with a trailing slash
      // (e.g. 'https://openrouter.ai/api/v1/'), the resulting URL is
      // 'https://openrouter.ai/api/v1//chat/completions' (double slash).
      // Some API providers reject double-slash URLs with 404 or routing errors.
      mockPropsStore.LLM_API_KEY = 'test-key';
      mockPropsStore.LLM_BASE_URL = 'https://openrouter.ai/api/v1/';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      const msg = createMockMessage({ subject: 'Test', body: 'Test', attachments: [] });
      const thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const url = fetchCall[0];
      // URL should NOT contain double slashes (except after protocol)
      const urlWithoutProtocol = url.replace('https://', '');
      expect(urlWithoutProtocol).not.toContain('//');
    });
  });
});
