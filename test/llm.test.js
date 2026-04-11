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

    test('extracts PDF text via DocumentApp and cleans up temp file', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      const pdfAtt = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        subject: 'Invoice',
        body: 'Please pay',
        attachments: [pdfAtt],
      });
      const thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      expect(mockDriveApp.createFile).toHaveBeenCalled();
    });

    test('handles PDF text extraction failure gracefully', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDriveApp.createFile.mockImplementationOnce(() => {
        throw new Error('Cannot create file');
      });

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.7,\\"reason\\":\\"test\\"}"}}]}'
      );

      const pdfAtt = createMockAttachment('broken.pdf');
      const msg = createMockMessage({
        subject: 'Invoice',
        body: 'Please pay',
        attachments: [pdfAtt],
      });
      const thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;

      expect(userContent).toContain('broken.pdf');
    });

    test('truncates PDF text to 3000 characters', () => {
      mockPropsStore.LLM_API_KEY = 'test-key';
      Config.__reset();

      mockDocBody.getText.mockReturnValue('x'.repeat(5000));

      mockHttpResponse.getResponseCode.mockReturnValue(200);
      mockHttpResponse.getContentText.mockReturnValue(
        '{"choices":[{"message":{"content":"{\\"is_invoice\\":true,\\"confidence\\":0.9,\\"reason\\":\\"test\\"}"}}]}'
      );

      const pdfAtt = createMockAttachment('long.pdf');
      const msg = createMockMessage({
        subject: 'Test',
        body: 'Test',
        attachments: [pdfAtt],
      });
      const thread = createMockThread({ messages: [msg] });

      LlmClassifier.classifyInvoice(msg, thread);

      const fetchCall = UrlFetchApp.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].payload);
      const userContent = payload.messages[1].content;

      const pdfSection = userContent.split('--- PDF attachment content ---')[1];
      expect(pdfSection.length).toBeLessThanOrEqual(3001);
    });
  });
});
