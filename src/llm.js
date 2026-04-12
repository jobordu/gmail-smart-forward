/* exported LlmClassifier */
// llm.js
// OpenAI-compatible LLM client for invoice classification.
// Works with any OpenAI-style provider: Together AI, AkashML, OpenAI, etc.
// Uses multimodal input: email subject + body + first PDF attachment text.
// PDF text is extracted via Apps Script's Drive API — no image rendering needed.
// This works with any model (vision or text-only) and avoids the
// incompatibility where most LLM APIs cannot decode raw PDF base64.

var LlmClassifier = (function () {

  var SYSTEM_PROMPT = [
    'You are an invoice detection assistant.',
    'You will receive an email (subject and body) and optionally the text content of a PDF attachment.',
    'Determine whether this email is delivering an invoice, bill, receipt, or payment confirmation.',
    'Respond ONLY with a JSON object. No other text. No markdown. No explanation.',
    'The JSON must use actual boolean and number values, not the words "boolean" or "number".',
    'Example: {"is_invoice": true, "confidence": 0.95, "reason": "It is an invoice"}',
    'Structure: {"is_invoice": <true|false>, "confidence": <0.0-1.0>, "reason": "<one sentence>"}',
  ].join(' ');

  var PDF_TEXT_LIMIT = 3000;

  function _extractPdfText(thread) {
    var messages = thread.getMessages();
    for (var i = 0; i < messages.length; i++) {
      var attachments = messages[i].getAttachments();
      for (var j = 0; j < attachments.length; j++) {
        var att = attachments[j];
        if (att.getName().toLowerCase().endsWith('.pdf')) {
          try {
            var blob = att.copyBlob();
            var contentType = blob.getContentType();
            if (contentType === 'application/pdf' || contentType === 'application/x-pdf') {
              var tempFile = DriveApp.createFile(blob);
              tempFile.setTrashed(true);
              var doc = DocumentApp.openById(tempFile.getId());
              var text = doc.getBody().getText();
              return text.substring(0, PDF_TEXT_LIMIT);
            }
          } catch (e) {
            Log.info('PDF text extraction failed, falling back to filename: ' + e.message);
          }
          return '[PDF attachment: ' + att.getName() + ']';
        }
      }
    }
    return null;
  }

  function _buildUserContent(subject, body, pdfText) {
    var text = 'Email subject: ' + subject + '\n\nEmail body:\n' + body.substring(0, 3000);

    if (pdfText) {
      text += '\n\n--- PDF attachment content ---\n' + pdfText;
    }

    return text;
  }

  function _callApi(userContent) {
    var apiKey    = Config.getLlmApiKey();
    var model     = Config.getLlmModel();
    var baseUrl   = Config.getLlmBaseUrl();

    var payload = {
      model: model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userContent   }
      ],
      max_tokens: 2000,
      temperature: 0,
      response_format: { type: 'json_object' }
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(baseUrl + '/chat/completions', options);
    var code = response.getResponseCode();
    if (code !== 200) {
      throw new Error('LLM API returned ' + code + ': ' + response.getContentText().substring(0, 200));
    }

    var body = JSON.parse(response.getContentText());
    var msg = body.choices[0].message;
    var raw = msg.content || '';

    if (!raw || raw.trim().length === 0) {
      if (msg.reasoning) {
        var match = msg.reasoning.match(/\{[\s\S]*\}/);
        if (match) {
          raw = match[0];
        }
      }
    }

    return JSON.parse(raw);
  }

  return {
    // Classifies whether the email + PDF is an invoice.
    // Returns { is_invoice: bool, confidence: float, reason: string }
    // Throws on API or parse errors — caller should handle gracefully.
    classifyInvoice: function (message, thread) {
      var subject  = message.getSubject();
      var body     = message.getPlainBody();
      var pdfText  = _extractPdfText(thread);
      var content  = _buildUserContent(subject, body, pdfText);

      return _callApi(content);
    },
  };
})();
