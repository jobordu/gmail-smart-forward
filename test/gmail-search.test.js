describe('GmailSearch', () => {
  beforeEach(() => {
    resetTestState();
  });

  describe('forDiscovery', () => {
    test('returns search results', () => {
      const threads = [createMockThread(), createMockThread({ id: 't2' })];
      mockGmailApp.search.mockReturnValue(threads);

      const result = GmailSearch.forDiscovery(30);

      expect(result).toHaveLength(2);
      expect(mockGmailApp.search).toHaveBeenCalled();
      const query = mockGmailApp.search.mock.calls[0][0];
      expect(query).toContain('after:');
      expect(query).toContain('subject:(invoice OR receipt');
      expect(query).toContain('filename:pdf');
      expect(query).toContain('-in:sent');
    });

    test('returns empty array when no results', () => {
      mockGmailApp.search.mockReturnValue([]);

      const result = GmailSearch.forDiscovery(30);
      expect(result).toHaveLength(0);
    });

    test('paginates results when more than one page', () => {
      const page1 = Array.from({ length: 100 }, (_, i) => createMockThread({ id: `t${i}` }));
      const page2 = Array.from({ length: 50 }, (_, i) => createMockThread({ id: `t${i + 100}` }));

      mockGmailApp.search
        .mockReturnValueOnce(page1)
        .mockReturnValueOnce(page2);

      const result = GmailSearch.forDiscovery(365);

      expect(result).toHaveLength(150);
      expect(mockGmailApp.search).toHaveBeenCalledTimes(2);
    });

    test('stops pagination when page is smaller than pageSize', () => {
      const page1 = Array.from({ length: 50 }, (_, i) => createMockThread({ id: `t${i}` }));
      mockGmailApp.search.mockReturnValue(page1);

      const result = GmailSearch.forDiscovery(365);

      expect(result).toHaveLength(50);
      expect(mockGmailApp.search).toHaveBeenCalledTimes(1);
    });

    test('stops when search returns null', () => {
      mockGmailApp.search.mockReturnValue(null);

      const result = GmailSearch.forDiscovery(365);
      expect(result).toHaveLength(0);
    });
  });

  describe('forBackfill', () => {
    test('builds query with keywords and attachment filters', () => {
      mockGmailApp.search.mockReturnValue([]);

      GmailSearch.forBackfill(null);

      const query = mockGmailApp.search.mock.calls[0][0];
      expect(query).toContain('-label:gmail-smart-forward/forwarded');
      expect(query).toContain('-label:gmail-smart-forward/rejected');
      expect(query).toContain('-in:sent');
      expect(query).toContain('filename:pdf');
    });

    test('includes after date when provided', () => {
      mockGmailApp.search.mockReturnValue([]);

      GmailSearch.forBackfill('2025-01-01');

      const query = mockGmailApp.search.mock.calls[0][0];
      expect(query).toContain('after:2025/01/01');
    });

    test('does not include after date when null', () => {
      mockGmailApp.search.mockReturnValue([]);

      GmailSearch.forBackfill(null);

      const query = mockGmailApp.search.mock.calls[0][0];
      expect(query).not.toContain('after:');
    });
  });

  describe('forLive', () => {
    test('searches recent emails excluding forwarded', () => {
      mockGmailApp.search.mockReturnValue([]);

      GmailSearch.forLive(20);

      const query = mockGmailApp.search.mock.calls[0][0];
      expect(query).toContain('after:');
      expect(query).toContain('-label:gmail-smart-forward/forwarded');
      expect(query).toContain('-label:gmail-smart-forward/rejected');
      expect(query).toContain('-in:sent');
      expect(query).toContain('-in:drafts');
    });

    test('respects maxEmailsPerRun from config', () => {
      mockPropsStore.MAX_EMAILS_PER_RUN = '5';
      Config.__reset();
      mockGmailApp.search.mockReturnValue([]);

      GmailSearch.forLive(20);

      const maxResults = mockGmailApp.search.mock.calls[0][2];
      expect(maxResults).toBe(5);
    });
  });
});
