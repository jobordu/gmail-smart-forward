// logging.js
// Structured logging helpers. Output goes to Apps Script execution log (Logger).

var Log = (function () {
  var _entries = [];

  function _entry(type, data) {
    var entry = Object.assign({ type: type, ts: new Date().toISOString() }, data);
    _entries.push(entry);
    Logger.log(JSON.stringify(entry));
    return entry;
  }

  return {
    forwarded: function (message, thread) {
      return _entry('FORWARDED', {
        to:      Config.getForwardToEmail(),
        from:    message.getFrom(),
        subject: message.getSubject(),
        date:    message.getDate().toISOString(),
        threadId: thread.getId(),
        dryRun:  Config.isDryRun(),
      });
    },

    rejected: function (message, thread, reason) {
      return _entry('REJECTED', {
        reason:  reason,
        from:    message.getFrom(),
        subject: message.getSubject(),
        date:    message.getDate().toISOString(),
        threadId: thread.getId(),
      });
    },

    discovered: function (senderData) {
      return _entry('DISCOVERED', senderData);
    },

    info: function (msg, data) {
      return _entry('INFO', Object.assign({ msg: msg }, data || {}));
    },

    error: function (msg, err) {
      return _entry('ERROR', { msg: msg, error: String(err) });
    },

    // Print a summary table to the Apps Script log
    printSummary: function () {
      var forwarded = _entries.filter(function (e) { return e.type === 'FORWARDED'; });
      var rejected  = _entries.filter(function (e) { return e.type === 'REJECTED'; });
      var discovered = _entries.filter(function (e) { return e.type === 'DISCOVERED'; });

      Logger.log('=== RUN SUMMARY ===');
      Logger.log('Forwarded: ' + forwarded.length + (Config.isDryRun() ? ' (DRY RUN)' : ''));
      Logger.log('Rejected:  ' + rejected.length);
      Logger.log('Discovered: ' + discovered.length);

      if (rejected.length > 0) {
        var reasons = {};
        rejected.forEach(function (e) {
          reasons[e.reason] = (reasons[e.reason] || 0) + 1;
        });
        Logger.log('Rejection reasons: ' + JSON.stringify(reasons));
      }
    },

    getEntries: function () { return _entries.slice(); },

    __reset: function () { _entries = []; },
  };
})();
