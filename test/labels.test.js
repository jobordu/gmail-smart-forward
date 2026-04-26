describe('Labels', () => {
  beforeEach(() => {
    resetTestState();
  });

  test('setup creates all four labels', () => {
    Labels.setup();

    expect(mockGmailApp.createLabel).toHaveBeenCalledTimes(4);
    expect(mockGmailApp.createLabel).toHaveBeenCalledWith('gmail-smart-forward/candidate');
    expect(mockGmailApp.createLabel).toHaveBeenCalledWith('gmail-smart-forward/forwarded');
    expect(mockGmailApp.createLabel).toHaveBeenCalledWith('gmail-smart-forward/rejected');
    expect(mockGmailApp.createLabel).toHaveBeenCalledWith('gmail-smart-forward/discovered');
  });

  test('setup reuses existing labels', () => {
    const existingLabel = createMockLabel('gmail-smart-forward/candidate');
    mockLabelsRegistry['gmail-smart-forward/candidate'] = existingLabel;

    Labels.__reset();
    Labels.setup();

    expect(mockGmailApp.createLabel).toHaveBeenCalledTimes(3);
  });

  test('getCandidate returns the candidate label', () => {
    const label = Labels.getCandidate();
    expect(label.getName()).toBe('gmail-smart-forward/candidate');
  });

  test('getForwarded returns the forwarded label', () => {
    const label = Labels.getForwarded();
    expect(label.getName()).toBe('gmail-smart-forward/forwarded');
  });

  test('getRejected returns the rejected label', () => {
    const label = Labels.getRejected();
    expect(label.getName()).toBe('gmail-smart-forward/rejected');
  });

  test('getDiscovered returns the discovered label', () => {
    const label = Labels.getDiscovered();
    expect(label.getName()).toBe('gmail-smart-forward/discovered');
  });

  test('applyForwarded adds forwarded label and removes candidate label', () => {
    const thread = createMockThread();
    Labels.applyForwarded(thread);

    expect(thread.addLabel).toHaveBeenCalled();
    expect(thread.removeLabel).toHaveBeenCalled();

    const addCall = thread.addLabel.mock.calls[0][0];
    expect(addCall.getName()).toBe('gmail-smart-forward/forwarded');

    const removeCall = thread.removeLabel.mock.calls[0][0];
    expect(removeCall.getName()).toBe('gmail-smart-forward/candidate');
  });

  test('applyRejected adds rejected label', () => {
    const thread = createMockThread();
    Labels.applyRejected(thread);

    expect(thread.addLabel).toHaveBeenCalledTimes(1);
    const addedLabel = thread.addLabel.mock.calls[0][0];
    expect(addedLabel.getName()).toBe('gmail-smart-forward/rejected');
  });

  test('applyDiscovered adds discovered label', () => {
    const thread = createMockThread();
    Labels.applyDiscovered(thread);

    expect(thread.addLabel).toHaveBeenCalledTimes(1);
    const addedLabel = thread.addLabel.mock.calls[0][0];
    expect(addedLabel.getName()).toBe('gmail-smart-forward/discovered');
  });

  test('isForwarded returns true when thread has forwarded label', () => {
    const fwdLabel = Labels.getForwarded();
    const thread = createMockThread({ labels: [fwdLabel] });
    expect(Labels.isForwarded(thread)).toBe(true);
  });

  test('isForwarded returns false when thread does not have forwarded label', () => {
    const thread = createMockThread({ labels: [] });
    expect(Labels.isForwarded(thread)).toBe(false);
  });

  test('isForwarded returns false for other labels', () => {
    const candidateLabel = Labels.getCandidate();
    const thread = createMockThread({ labels: [candidateLabel] });
    expect(Labels.isForwarded(thread)).toBe(false);
  });

  test('__reset clears label cache', () => {
    Labels.getCandidate();
    Labels.__reset();
    const label = Labels.getCandidate();
    expect(label.getName()).toBe('gmail-smart-forward/candidate');
  });

  test('caches label lookups', () => {
    const label1 = Labels.getCandidate();
    const label2 = Labels.getCandidate();
    expect(label1).toBe(label2);
  });

  test('BUG: applyRejected does not remove candidate label, unlike applyForwarded — rejected threads stay in candidate search results', () => {
    // applyForwarded calls both addLabel(forwarded) and removeLabel(candidate).
    // applyRejected only calls addLabel(rejected) — it does NOT remove candidate.
    // This means rejected threads retain the candidate label and will appear in
    // any search or filter targeting candidate-labeled threads, causing them to
    // be re-evaluated on subsequent runs (until classify returns 'already-forwarded'
    // or 'excluded-sender' again, wasting compute).
    const candidateLabel = Labels.getCandidate();
    const thread = createMockThread({ labels: [candidateLabel] });

    Labels.applyRejected(thread);

    // After rejection, thread should NOT still have the candidate label
    const threadLabels = thread.getLabels();
    const hasCandidateStill = threadLabels.some(l => l.getName() === candidateLabel.getName());
    expect(hasCandidateStill).toBe(false);
  });
});
