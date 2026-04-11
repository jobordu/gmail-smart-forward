describe('Forwarding', () => {
  beforeEach(() => {
    resetTestState();
  });

  describe('forwardToTarget', () => {
    test('in dry-run mode logs but does not forward', () => {
      mockPropsStore.DRY_RUN = 'true';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      Forwarding.forwardToTarget(thread);

      expect(msg.forward).not.toHaveBeenCalled();
    });

    test('in live mode forwards the message', () => {
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      Forwarding.forwardToTarget(thread);

      expect(msg.forward).toHaveBeenCalledWith('test@target.com');
    });

    test('in live mode applies forwarded label', () => {
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      Forwarding.forwardToTarget(thread);

      expect(thread.addLabel).toHaveBeenCalled();
      expect(thread.removeLabel).toHaveBeenCalled();
    });

    test('in dry-run mode does not apply forwarded label', () => {
      mockPropsStore.DRY_RUN = 'true';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [msg] });

      Forwarding.forwardToTarget(thread);

      expect(thread.addLabel).not.toHaveBeenCalled();
    });

    test('forwards only messages from allowlisted senders with allowed attachments', () => {
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.ALLOWED_SENDERS = 'allowed@example.com';
      Config.__reset();

      const att = createMockAttachment('invoice.pdf');
      const allowedMsg = createMockMessage({
        from: '<allowed@example.com>',
        attachments: [att],
      });
      const unallowedMsg = createMockMessage({
        from: '<other@example.com>',
        attachments: [att],
      });
      const thread = createMockThread({ messages: [allowedMsg, unallowedMsg] });

      Forwarding.forwardToTarget(thread);

      expect(allowedMsg.forward).toHaveBeenCalledTimes(1);
      expect(unallowedMsg.forward).not.toHaveBeenCalled();
    });

    test('skips messages without allowed attachment extensions', () => {
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const jpgAtt = createMockAttachment('photo.jpg');
      const msg = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [jpgAtt],
      });
      const thread = createMockThread({ messages: [msg] });

      Forwarding.forwardToTarget(thread);

      expect(msg.forward).not.toHaveBeenCalled();
    });

    test('forwards multiple qualifying messages in a thread', () => {
      mockPropsStore.DRY_RUN = 'false';
      mockPropsStore.ALLOWED_SENDERS = 'supplier@example.com';
      Config.__reset();

      const att1 = createMockAttachment('invoice-v1.pdf');
      const att2 = createMockAttachment('invoice-v2.pdf');
      const msg1 = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att1],
      });
      const msg2 = createMockMessage({
        from: '<supplier@example.com>',
        attachments: [att2],
      });
      const thread = createMockThread({ messages: [msg1, msg2] });

      Forwarding.forwardToTarget(thread);

      expect(msg1.forward).toHaveBeenCalledTimes(1);
      expect(msg2.forward).toHaveBeenCalledTimes(1);
    });
  });

  describe('markRejected', () => {
    test('applies rejected label and logs rejection', () => {
      const msg = createMockMessage();
      const thread = createMockThread({ messages: [msg] });

      Forwarding.markRejected(thread, 'excluded-sender');

      expect(thread.addLabel).toHaveBeenCalledTimes(1);
      const addedLabel = thread.addLabel.mock.calls[0][0];
      expect(addedLabel.getName()).toBe('gmail-smart-forward/rejected');
    });

    test('uses last message in thread for logging', () => {
      const firstMsg = createMockMessage({ subject: 'First' });
      const lastMsg = createMockMessage({ subject: 'Last' });
      const thread = createMockThread({ messages: [firstMsg, lastMsg] });

      Forwarding.markRejected(thread, 'test-reason');

      const entries = Log.getEntries();
      const rejectedEntry = entries.find(e => e.type === 'REJECTED');
      expect(rejectedEntry).toBeDefined();
      expect(rejectedEntry.subject).toBe('Last');
    });
  });
});
