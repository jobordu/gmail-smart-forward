/* exported GmailSearch */
// gmail-search.js
// Gmail query helpers. All searches return GmailThread arrays.

var GmailSearch = (function () {

  // Format a Date to Apps Script Gmail search format: YYYY/MM/DD
  function _formatDate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '/' + m + '/' + d;
  }

  // Return a Date N days ago from now
  function _daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  // Sanitize a label name for use in Gmail search queries.
  // Wraps in quotes after removing internal quotes to prevent query injection.
  function _safeLabel(name) {
    return '"' + name.replace(/"/g, '') + '"';
  }

  // Paginate GmailApp.search to collect up to maxResults threads
  function _search(query, maxResults) {
    var results = [];
    var start = 0;
    var pageSize = 100;
    while (results.length < maxResults) {
      var page = GmailApp.search(query, start, Math.min(pageSize, maxResults - results.length));
      if (!page || page.length === 0) break;
      results = results.concat(page);
      start += page.length;
      if (page.length < pageSize) break;
    }
    return results;
  }

  return {
    // Broad discovery search: receipts/invoices/PDFs in last N days
    forDiscovery: function (days) {
      var since = _formatDate(_daysAgo(days));
      var query = [
        'after:' + since,
        '(',
          'subject:(invoice OR receipt OR "order confirmation" OR "payment confirmation")',
          'OR filename:pdf',
          'OR filename:invoice',
          'OR filename:receipt',
        ')',
        '-in:sent',
        '-in:drafts',
      ].join(' ');
      return _search(query, 2000);
    },

    // Candidate search: threads not yet labeled forwarded
    forBackfill: function (afterDateStr) {
      var parts = [
        '-label:' + _safeLabel(Config.getForwardedLabel()),
        '-label:' + _safeLabel(Config.getRejectedLabel()),
        '-in:sent',
        '-in:drafts',
      ];
      if (afterDateStr) {
        // afterDateStr should be YYYY-MM-DD or YYYY/MM/DD
        var normalized = afterDateStr.replace(/-/g, '/');
        if (!/^\d{4}\/\d{2}\/\d{2}$/.test(normalized)) {
          throw new Error('Invalid BACKFILL_AFTER_DATE format: "' + afterDateStr + '". Expected YYYY-MM-DD or YYYY/MM/DD.');
        }
        var dateParts = normalized.split('/');
        var parsed = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
        if (parsed.getFullYear() !== parseInt(dateParts[0], 10) ||
            parsed.getMonth() !== parseInt(dateParts[1], 10) - 1 ||
            parsed.getDate() !== parseInt(dateParts[2], 10)) {
          throw new Error('Invalid BACKFILL_AFTER_DATE value: "' + afterDateStr + '". Date does not exist.');
        }
        parts.push('after:' + normalized);
      }
      var subjectKw = Config.getSubjectKeywords();
      var kwQuery = subjectKw.map(function (kw) { return '"' + kw + '"'; }).join(' OR ');
      parts.push('(subject:(' + kwQuery + ') OR filename:pdf OR filename:invoice OR filename:receipt)');
      return _search(parts.join(' '), 1000);
    },

    // Live search: threads from the last N minutes not yet forwarded
    forLive: function (minutesBack) {
      var since = new Date();
      since.setMinutes(since.getMinutes() - minutesBack);
      var query = [
        'after:' + _formatDate(since),
        '-label:' + _safeLabel(Config.getForwardedLabel()),
        '-label:' + _safeLabel(Config.getRejectedLabel()),
        '-in:sent',
        '-in:drafts',
      ].join(' ');
      return _search(query, Config.getMaxEmailsPerRun());
    },
  };
})();
