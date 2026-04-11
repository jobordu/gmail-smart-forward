const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const INVOICE_PNG = fs.readFileSync(path.resolve(__dirname, 'fixtures/invoice.png'));
const NEWSLETTER_PNG = fs.readFileSync(path.resolve(__dirname, 'fixtures/newsletter.png'));

const REAL_LLM_API_KEY = process.env.LLM_API_KEY;
const REAL_LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.together.xyz/v1';
const REAL_LLM_MODEL = process.env.LLM_MODEL || 'Qwen/Qwen3-VL-8B-Instruct';

const TIMEOUT_MS = 60000;

function realFetch(url, options) {
  const https = require('https');
  const http = require('http');
  const mod = url.startsWith('https') ? https : http;

  return new Promise((resolve, reject) => {
    const req = mod.request(url, {
      method: options.method || 'POST',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        options.headers || {}
      ),
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({
          getResponseCode: () => res.statusCode,
          getContentText: () => body,
        });
      });
    });
    req.on('error', reject);
    req.write(options.payload);
    req.end();
  });
}

function buildPayload(subject, body, imageBuffer) {
  const content = [];

  content.push({
    type: 'text',
    text: 'Email subject: ' + subject + '\n\nEmail body:\n' + (body || '').substring(0, 3000),
  });

  if (imageBuffer) {
    const b64 = imageBuffer.toString('base64');
    content.push({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,' + b64 },
    });
  }

  const isThinkingModel = REAL_LLM_MODEL.toLowerCase().includes('gemma-4');

  const systemParts = [
    'You are an invoice detection assistant.',
    'You will receive an email (subject and body) and optionally a document image.',
    'Determine whether this email is delivering an invoice, bill, receipt, or payment confirmation.',
    'Respond ONLY with a JSON object. No other text. No markdown. No explanation.',
    'The JSON must use actual boolean and number values, not the words "boolean" or "number".',
    'Example: {"is_invoice": true, "confidence": 0.95, "reason": "It is an invoice"}',
    'Structure: {"is_invoice": <true|false>, "confidence": <0.0-1.0>, "reason": "<one sentence>"}',
  ];

  if (isThinkingModel) {
    systemParts.push('IMPORTANT: Put your final JSON answer in your response content, NOT in your reasoning.');
  }

  const payload = {
    model: REAL_LLM_MODEL,
    messages: [
      { role: 'system', content: systemParts.join(' ') },
      { role: 'user', content },
    ],
    max_tokens: isThinkingModel ? 1024 : 200,
    temperature: 0,
  };

  if (!isThinkingModel) {
    payload.response_format = { type: 'json_object' };
  }

  return payload;
}

async function classify(subject, body, imageBuffer) {
  const payload = buildPayload(subject, body, imageBuffer);
  const url = REAL_LLM_BASE_URL + '/chat/completions';
  const options = {
    method: 'post',
    headers: { Authorization: 'Bearer ' + REAL_LLM_API_KEY },
    payload: JSON.stringify(payload),
  };

  const response = await realFetch(url, options);
  const code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('LLM API returned ' + code + ': ' + response.getContentText().substring(0, 300));
  }

  const respBody = JSON.parse(response.getContentText());

  if (!respBody.choices || !respBody.choices[0] || !respBody.choices[0].message) {
    throw new Error('Unexpected response: ' + response.getContentText().substring(0, 300));
  }

  const msg = respBody.choices[0].message;
  let raw = msg.content || '';

  if (!raw || raw.trim().length === 0) {
    if (msg.reasoning) {
      const match = msg.reasoning.match(/\{[\s\S]*\}/);
      if (match) {
        raw = match[0];
      }
    }
  }

  if (!raw || raw.trim().length === 0) {
    throw new Error('Empty LLM response. Full API response: ' + response.getContentText().substring(0, 500));
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Could not parse LLM response as JSON: ' + raw.substring(0, 300));
    }
  }

  return parsed;
}

const describeOrSkip = REAL_LLM_API_KEY ? describe : describe.skip;

describeOrSkip('E2E: LLM classification with real PDF (rendered as PNG)', () => {
  jest.setTimeout(TIMEOUT_MS);

  test('classifies invoice email + real invoice PDF as invoice (high confidence)', async () => {
    const result = await classify(
      'Invoice #INV-2025-0042 from Acme Corp',
      'Please find attached invoice for EUR 1,250.00. Payment is due within 30 days.',
      INVOICE_PNG
    );

    expect(result).toHaveProperty('is_invoice');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('reason');
    expect(typeof result.is_invoice).toBe('boolean');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.is_invoice).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  test('classifies newsletter email + real newsletter PDF as NOT invoice', async () => {
    const result = await classify(
      'Weekly Newsletter - April 2025',
      'Check out our top 10 summer deals! Unsubscribe at any time.',
      NEWSLETTER_PNG
    );

    expect(result).toHaveProperty('is_invoice');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('reason');
    expect(typeof result.is_invoice).toBe('boolean');
    expect(typeof result.confidence).toBe('number');
    expect(result.is_invoice).toBe(false);
  });

  test('classifies invoice email WITHOUT attachment as invoice (text only)', async () => {
    const result = await classify(
      'Your invoice from Supplier Inc.',
      'Dear customer, your invoice for March 2025 is available. Amount due: $500.00.',
      null
    );

    expect(result).toHaveProperty('is_invoice');
    expect(typeof result.is_invoice).toBe('boolean');
    expect(result.is_invoice).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  test('classifies random personal email as NOT invoice', async () => {
    const result = await classify(
      'Hey, how are you?',
      'Just wanted to check in and see how things are going. Let me know if you want to grab coffee sometime next week!',
      null
    );

    expect(result).toHaveProperty('is_invoice');
    expect(typeof result.is_invoice).toBe('boolean');
    expect(result.is_invoice).toBe(false);
  });

  test('response structure matches expected schema exactly', async () => {
    const result = await classify(
      'Receipt for your purchase',
      'Thank you for your purchase. Your receipt is attached.',
      INVOICE_PNG
    );

    expect(Object.keys(result).sort()).toEqual(['confidence', 'is_invoice', 'reason']);
    expect(typeof result.is_invoice).toBe('boolean');
    expect(typeof result.confidence).toBe('number');
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test('real PDF content influences classification (invoice PDF with neutral subject)', async () => {
    const result = await classify(
      'Document for your review',
      'Please review the attached document.',
      INVOICE_PNG
    );

    expect(result).toHaveProperty('is_invoice');
    expect(result.confidence).toBeGreaterThan(0);
    expect(typeof result.is_invoice).toBe('boolean');
  });
});
