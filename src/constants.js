// constants.js
// Static defaults — keyword lists, label names, limits.
// All runtime config comes from Script Properties (config.js).

var LABEL_NAMES = {
  CANDIDATE:  'revolut-candidate',
  FORWARDED:  'revolut-forwarded',
  REJECTED:   'revolut-rejected',
  DISCOVERED: 'revolut-discovered',
};

var DEFAULT_SUBJECT_KEYWORDS = [
  'invoice',
  'receipt',
  'order confirmation',
  'payment confirmation',
  'your order',
  'tax invoice',
  'statement',
  'billing',
  'your receipt',
];

var DEFAULT_ATTACHMENT_KEYWORDS = [
  'invoice',
  'receipt',
  'statement',
  'billing',
];

var DEFAULT_EXCLUDED_KEYWORDS = [
  'unsubscribe',
  'newsletter',
  'marketing',
  'promotion',
  'offer',
  'sale',
  'deal',
  'discount',
];

var DEFAULT_DISCOVERY_DAYS = 365;
var DEFAULT_MAX_EMAILS_PER_RUN = 50;
var DEFAULT_DRY_RUN = true;
