/* exported discoverSuppliers */
// discovery.js
// Read-only scan of historical email to surface likely suppliers.
// No emails are forwarded or labeled during discovery.

function discoverSuppliers() {
  var days = Config.getDiscoveryDays();
  Log.info('Starting discovery', { days: days });

  var threads = GmailSearch.forDiscovery(days);
  Log.info('Threads found for discovery', { count: threads.length });

  // Aggregate per-sender stats
  var senderMap = Object.create(null);

  threads.forEach(function (thread) {
    var messages = thread.getMessages();
    messages.forEach(function (message) {
      var email   = Classifier.getSenderEmail(message);
      var domain  = Classifier.getSenderDomain(message);

      if (!senderMap[email]) {
        senderMap[email] = {
          email:       email,
          domain:      domain,
          totalEmails: 0,
          withPdf:     0,
          subjects:    [],
          firstSeen:   message.getDate(),
          lastSeen:    message.getDate(),
          keywords:    {},
        };
      }

      var entry = senderMap[email];
      entry.totalEmails++;

      var msgDate = message.getDate();
      if (msgDate && entry.firstSeen && msgDate < entry.firstSeen) entry.firstSeen = msgDate;
      if (msgDate && entry.lastSeen && msgDate > entry.lastSeen)  entry.lastSeen  = msgDate;

      // PDF attachment count
      if (Classifier.hasValidAttachment(message)) entry.withPdf++;

      // Collect up to 3 sample subjects
      if (entry.subjects.length < 3) entry.subjects.push(message.getSubject() || '(no subject)');

      // Track which keywords matched in subject
      var subjectKw = Config.getSubjectKeywords();
      var subject = message.getSubject() || '';
      subjectKw.forEach(function (kw) {
        if (subject.toLowerCase().indexOf(kw) !== -1) {
          entry.keywords[kw] = (entry.keywords[kw] || 0) + 1;
        }
      });
    });
  });

  // Convert to sorted array: most emails first
  var candidates = Object.values(senderMap);
  candidates.sort(function (a, b) { return b.totalEmails - a.totalEmails; });

  // Print discovery report
  Logger.log('=== DISCOVERY REPORT ===');
  Logger.log('Total unique senders found: ' + candidates.length);
  Logger.log('');

  candidates.forEach(function (c) {
    Log.discovered({
      email:       c.email,
      domain:      c.domain,
      totalEmails: c.totalEmails,
      withPdf:     c.withPdf,
      subjects:    c.subjects,
      keywords:    Object.keys(c.keywords),
      firstSeen:   c.firstSeen ? c.firstSeen.toISOString().slice(0, 10) : null,
      lastSeen:    c.lastSeen  ? c.lastSeen.toISOString().slice(0, 10)  : null,
    });
  });

  Log.info('Discovery complete', { uniqueSenders: candidates.length });
  Log.printSummary();

  return candidates;
}
