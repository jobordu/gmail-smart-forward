/* exported Config */
// config.js
// Loads all runtime config from Script Properties.
// Set these in Apps Script > Project Settings > Script Properties.

var Config = (function () {
  var _props = null;

  function _load() {
    if (!_props) {
      _props = PropertiesService.getScriptProperties().getProperties();
    }
    return _props;
  }

  function _get(key, defaultValue) {
    var val = _load()[key];
    if (val === undefined) return defaultValue;
    val = val.trim();
    return val !== '' ? val : defaultValue;
  }

  function _getList(key, defaultList) {
    var props = _load();
    var raw = props[key];
    if (raw === undefined) return defaultList || [];
    raw = raw.trim();
    if (raw === '') return [];
    return raw.split(',').map(function (s) {
      var trimmed = s.trim().toLowerCase();
      var angleStart = trimmed.lastIndexOf('<');
      if (angleStart === -1) return trimmed;
      var angleEnd = trimmed.indexOf('>', angleStart);
      if (angleEnd === -1) return trimmed;
      var extracted = trimmed.substring(angleStart + 1, angleEnd);
      if (extracted && !extracted.includes('@')) return '';
      return extracted;
    }).filter(Boolean);
  }

  function _getBool(key, defaultValue) {
    var val = _get(key, null);
    if (val === null) return defaultValue;
    return val.toLowerCase() === 'true';
  }

  function _getInt(key, defaultValue) {
    var val = parseInt(_get(key, defaultValue), 10);
    if (isNaN(val) || val < 0) return defaultValue;
    return val;
  }

  return {
    // Required
    getForwardToEmail: function () {
      var email = _get('FORWARD_TO_EMAIL', null);
      if (!email) throw new Error('Script Property FORWARD_TO_EMAIL is required.');
      return email;
    },

    // Allowlist
    getAllowedSenders: function () { return _getList('ALLOWED_SENDERS', []); },
    getAllowedDomains: function () { return _getList('ALLOWED_DOMAINS', []); },

    // Denylist
    getExcludedSenders: function () { return _getList('EXCLUDED_SENDERS', []); },
    getExcludedDomains: function () { return _getList('EXCLUDED_DOMAINS', []); },
    getExcludedKeywords: function () {
      return _getList('EXCLUDED_KEYWORDS', DEFAULT_EXCLUDED_KEYWORDS);
    },

    // Labels
    getCandidateLabel:  function () { return _get('CANDIDATE_LABEL',  LABEL_NAMES.CANDIDATE); },
    getForwardedLabel:  function () { return _get('FORWARDED_LABEL',  LABEL_NAMES.FORWARDED); },
    getRejectedLabel:   function () { return _get('REJECTED_LABEL',   LABEL_NAMES.REJECTED); },
    getDiscoveredLabel: function () { return _get('DISCOVERED_LABEL', LABEL_NAMES.DISCOVERED); },

    // Keyword matching
    getSubjectKeywords: function () {
      return _getList('SUBJECT_KEYWORDS', DEFAULT_SUBJECT_KEYWORDS);
    },
    getAttachmentKeywords: function () {
      return _getList('ATTACHMENT_FILENAME_KEYWORDS', DEFAULT_ATTACHMENT_KEYWORDS);
    },

    // Allowed attachment file extensions (without dot, lowercase).
    // Only threads containing at least one matching attachment will be forwarded.
    getAttachmentExtensions: function () {
      return _getList('ATTACHMENT_EXTENSIONS', DEFAULT_ATTACHMENT_EXTENSIONS);
    },

    // Operational
    getDiscoveryDays:       function () { return _getInt('DISCOVERY_DAYS', DEFAULT_DISCOVERY_DAYS); },
    getBackfillAfterDate:   function () { return _get('BACKFILL_AFTER_DATE', null); },
    isDryRun:               function () { return _getBool('DRY_RUN', DEFAULT_DRY_RUN); },
    getMaxEmailsPerRun:     function () {
      var val = _getInt('MAX_EMAILS_PER_RUN', DEFAULT_MAX_EMAILS_PER_RUN);
      return val === 0 ? DEFAULT_MAX_EMAILS_PER_RUN : val;
    },
    isLiveForwardingEnabled: function () { return _getBool('ENABLE_LIVE_FORWARDING', false); },

    // LLM invoice classification (multimodal — email + PDF)
    getLlmApiKey:             function () { return _get('LLM_API_KEY', null); },
    getLlmModel:              function () { return _get('LLM_MODEL', 'google/gemma-4-31b-it'); },
    getLlmBaseUrl:            function () { return _get('LLM_BASE_URL', 'https://api.together.xyz/v1'); },
    getLlmConfidenceThreshold: function () {
      var raw = parseFloat(_get('LLM_CONFIDENCE_THRESHOLD', '0.7'));
      return isNaN(raw) ? 0.7 : raw;
    },
    isLlmEnabled: function () { return _getBool('ENABLE_LLM_CLASSIFICATION', false); },

    __reset: function () { _props = null; },

    dump: function () {
      return {
        forwardToEmail:      _get('FORWARD_TO_EMAIL', '(not set)'),
        allowedSenders:      _getList('ALLOWED_SENDERS', []),
        allowedDomains:      _getList('ALLOWED_DOMAINS', []),
        excludedSenders:     _getList('EXCLUDED_SENDERS', []),
        excludedDomains:     _getList('EXCLUDED_DOMAINS', []),
        dryRun:              _getBool('DRY_RUN', DEFAULT_DRY_RUN),
        maxEmailsPerRun:     Config.getMaxEmailsPerRun(),
        liveForwarding:      _getBool('ENABLE_LIVE_FORWARDING', false),
        backfillAfterDate:   _get('BACKFILL_AFTER_DATE', '(not set)'),
        discoveryDays:       _getInt('DISCOVERY_DAYS', DEFAULT_DISCOVERY_DAYS),
      };
    },
  };
})();
