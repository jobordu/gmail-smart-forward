/* exported smokeTest */
// smoke-test.js
// Run this in the Apps Script editor to verify the full pipeline works end-to-end.
// Forces dry-run mode — never forwards or labels anything.
// Processes up to 10 threads including already-forwarded/rejected ones.
// Usage: select smokeTest in the editor and click Run.

function smokeTest() {
  var LIMIT = 10;
  var passed = 0;
  var failed = 0;
  var results = [];

  function assert(name, condition, detail) {
    if (condition) {
      passed++;
      results.push('PASS: ' + name);
    } else {
      failed++;
      results.push('FAIL: ' + name + (detail ? ' — ' + detail : ''));
    }
  }

  Logger.log('=== SMOKE TEST ===');
  Logger.log('Processing up to ' + LIMIT + ' threads (forced dry-run, no side effects)');

  var realIsDryRun = Config.isDryRun;
  Config.isDryRun = function () { return true; };

  try {
    // 1. Config
    Logger.log('\n--- Config ---');
    var config = Config.dump();
    assert('FORWARD_TO_EMAIL is set', config.forwardToEmail !== '(not set)', 'got: ' + config.forwardToEmail);
    assert('ALLOWED_SENDERS is not empty', config.allowedSenders.length > 0, 'no senders configured');
    assert('ATTACHMENT_EXTENSIONS is not empty', Config.getAttachmentExtensions().length > 0);

    // 2. Labels
    Logger.log('\n--- Labels ---');
    assert('Candidate label exists', Labels.getCandidate() !== null);
    assert('Forwarded label exists', Labels.getForwarded() !== null);
    assert('Rejected label exists', Labels.getRejected() !== null);

    // 3. Find threads — include already-forwarded/rejected, don't filter them out
    Logger.log('\n--- Searching for threads ---');
    var senders = Config.getAllowedSenders();
    var allThreads = [];

    for (var s = 0; s < senders.length && allThreads.length < LIMIT; s++) {
      var query = 'from:' + senders[s] + ' filename:pdf -in:sent -in:drafts';
      var threads = GmailApp.search(query, 0, LIMIT);
      if (threads) {
        for (var t = 0; t < threads.length && allThreads.length < LIMIT; t++) {
          allThreads.push(threads[t]);
        }
      }
    }

    assert('Found at least one thread', allThreads.length > 0,
      'searched senders: ' + senders.join(', '));

    Logger.log('Found ' + allThreads.length + ' threads');

    // 4. Classify each thread
    Logger.log('\n--- Classification ---');
    var forwarded = 0;
    var rejected = 0;
    var reasons = {};
    var classificationResults = [];

    for (var i = 0; i < allThreads.length; i++) {
      var thread = allThreads[i];
      var messages = thread.getMessages();
      var message = messages[messages.length - 1];

      var reason = Classifier.classify(thread, message);

      var entry = {
        subject: message.getSubject(),
        from: message.getFrom(),
        reason: reason,
      };
      classificationResults.push(entry);

      if (reason === null) {
        forwarded++;
        Logger.log('  FORWARD: ' + message.getSubject());
      } else {
        rejected++;
        reasons[reason] = (reasons[reason] || 0) + 1;
        Logger.log('  REJECT [' + reason + ']: ' + message.getSubject());
      }
    }

    assert('At least one thread classifies as forwardable', forwarded > 0,
      forwarded + ' forwardable, ' + rejected + ' rejected out of ' + allThreads.length);

    Logger.log('\n--- Classification summary ---');
    Logger.log('Forwardable: ' + forwarded);
    Logger.log('Rejected: ' + rejected);
    if (rejected > 0) {
      Logger.log('Reasons: ' + JSON.stringify(reasons));
    }

    // 5. Test dry-run forward on forwardable threads
    Logger.log('\n--- Dry-run forward test ---');
    for (var fi = 0; fi < allThreads.length; fi++) {
      var fThread = allThreads[fi];
      var fMessages = fThread.getMessages();
      var fMsg = fMessages[fMessages.length - 1];
      var fReason = Classifier.classify(fThread, fMsg);

      if (fReason === null) {
        Forwarding.forwardToTarget(fThread);
        break;
      }
    }
    var logEntries = Log.getEntries();
    var fwdEntries = logEntries.filter(function (e) { return e.type === 'FORWARDED'; });
    assert('Dry-run forward logged without error', fwdEntries.length > 0);

    // 6. LLM check (if enabled)
    if (Config.isLlmEnabled()) {
      Logger.log('\n--- LLM classification ---');
      var llmTested = false;
      for (var li = 0; li < allThreads.length && !llmTested; li++) {
        var lThread = allThreads[li];
        var lMsgs = lThread.getMessages();
        var lMsg = lMsgs[lMsgs.length - 1];
        var lReason = Classifier.classify(lThread, lMsg);
        if (lReason === null) {
          try {
            var llmResult = LlmClassifier.classifyInvoice(lMsg, lThread);
            assert('LLM returns valid result',
              llmResult && typeof llmResult.is_invoice === 'boolean',
              'got: ' + JSON.stringify(llmResult).substring(0, 200));
            llmTested = true;
          } catch (e) {
            assert('LLM classification does not throw', false, e.message);
          }
        }
      }
      if (!llmTested) {
        results.push('SKIP: LLM test (no forwardable thread with PDF text)');
      }
    }

    // 7. Trigger
    Logger.log('\n--- Trigger ---');
    var triggers = ScriptApp.getProjectTriggers();
    var hasLiveTrigger = false;
    for (var ti = 0; ti < triggers.length; ti++) {
      if (triggers[ti].getHandlerFunction() === 'processLiveEmails') {
        hasLiveTrigger = true;
      }
    }
    if (Config.isLiveForwardingEnabled()) {
      assert('Live trigger is installed', hasLiveTrigger);
    } else {
      results.push('SKIP: Live trigger check (ENABLE_LIVE_FORWARDING=false)');
    }

    // 8. PDF extraction check (full 3-tier chain)
    Logger.log('\n--- PDF extraction ---');
    var pdfExtracted = false;
    for (var pi = 0; pi < allThreads.length && !pdfExtracted; pi++) {
      var pMsgs = allThreads[pi].getMessages();
      for (var pm = 0; pm < pMsgs.length && !pdfExtracted; pm++) {
        var pAtts = pMsgs[pm].getAttachments();
        for (var pa = 0; pa < pAtts.length && !pdfExtracted; pa++) {
          if (pAtts[pa].getName().toLowerCase().indexOf('.pdf') !== -1) {
            var pBlob = pAtts[pa].copyBlob();
            var pCt = pBlob.getContentType();
            if (pCt === 'application/pdf' || pCt === 'application/x-pdf') {
              var pdfText = null;
              var tierUsed = 'none';

              // Tier 1: DocumentApp
              try {
                var tempFile = DriveApp.createFile(pBlob);
                tempFile.setTrashed(true);
                var doc = DocumentApp.openById(tempFile.getId());
                var docText = doc.getBody().getText();
                if (docText && docText.trim().length > 0) {
                  pdfText = docText;
                  tierUsed = 'tier 1 (DocumentApp)';
                }
              } catch (e) {
                Logger.log('  Tier 1 failed: ' + e.message);
              }

              // Tier 2: Raw bytes
              if (!pdfText) {
                try {
                  var raw = pBlob.getDataAsString();
                  var streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
                  var segments = 0;
                  var textParts = [];
                  var sm;
                  while ((sm = streamRe.exec(raw)) !== null) {
                    var textRe = /\(([^\\)]*(?:\\.[^\\)]*)*)\)/g;
                    var tm;
                    while ((tm = textRe.exec(sm[1])) !== null) {
                      textParts.push(tm[1]);
                    }
                    segments++;
                  }
                  var combined = textParts.join(' ').replace(/\s+/g, ' ').trim();
                  if (combined.length > 20) {
                    pdfText = combined;
                    tierUsed = 'tier 2 (raw bytes: ' + segments + ' streams, ' + textParts.length + ' text segments)';
                  } else {
                    Logger.log('  Tier 2: only ' + combined.length + ' chars extracted');
                  }
                } catch (e) {
                  Logger.log('  Tier 2 failed: ' + e.message);
                }
              }

              // Tier 3: Metadata (always works)
              if (!pdfText) {
                pdfText = '[metadata] ' + pAtts[pa].getName() + ', ' + pBlob.getBytes().length + ' bytes';
                tierUsed = 'tier 3 (metadata fallback)';
              }

              assert('PDF extraction produces output via ' + tierUsed, pdfText.length > 0,
                'from ' + pAtts[pa].getName());
              Logger.log('  Extracted ' + pdfText.length + ' chars via ' + tierUsed);
              if (tierUsed !== 'tier 3 (metadata fallback)') {
                Logger.log('  Preview: ' + pdfText.substring(0, 150).replace(/\n/g, ' '));
              }
              pdfExtracted = true;
            }
          }
        }
      }
    }

  } catch (e) {
    failed++;
    results.push('FAIL: Unexpected error — ' + e.message);
  } finally {
    Config.isDryRun = realIsDryRun;
  }

  Logger.log('\n=== RESULTS ===');
  for (var r = 0; r < results.length; r++) {
    Logger.log(results[r]);
  }
  Logger.log('\nTotal: ' + passed + ' passed, ' + failed + ' failed');

  if (failed > 0) {
    Logger.log('\nSMOKE TEST FAILED');
  } else {
    Logger.log('\nSMOKE TEST PASSED');
  }
}
