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
  // English — invoices & receipts
  'invoice',
  'receipt',
  'tax invoice',
  'proforma',
  'pro forma',
  'credit note',
  'debit note',
  'remittance',

  // English — payments & billing
  'payment confirmation',
  'payment receipt',
  'payment reminder',
  'order confirmation',
  'billing statement',
  'billing',
  'statement',
  'your receipt',
  'your invoice',
  'your order',
  'payslip',
  'pay slip',
  'salary',
  'payroll',

  // Portuguese — faturas & recibos
  'fatura',      // invoice (current spelling)
  'factura',     // invoice (old spelling, still common)
  'recibo',      // receipt
  'talão',       // receipt slip
  'nota de débito',   // debit note
  'nota de crédito',  // credit note

  // Portuguese — pagamentos
  'pagamento',           // payment
  'comprovativo',        // proof / confirmation of payment
  'confirmação de pagamento', // payment confirmation
  'aviso de pagamento',  // payment notice
  'liquidação',          // settlement / payment
  'aviso',               // notice (as in payment notice)

  // Portuguese — salários & documentos
  'recibo de vencimento',  // payslip (literally "salary receipt")
  'recibo de salário',     // payslip
  'vencimento',            // salary / due date
  'salário',               // salary
  'ordenado',              // salary (colloquial PT)
  'contra-recibo',         // pay stub

  // Portuguese — serviços & entrega
  'entrega dos serviços',  // delivery of services (ONI pattern)
  'planeamento de entrega', // delivery scheduling
  'prestação de serviços', // service provision
  'serviços',              // services

  // Portuguese — documentos fiscais
  'documento fiscal',   // fiscal document
  'declaração fiscal',  // tax declaration
  'extrato',            // statement / extract
  'nota de encomenda',  // purchase order
];

var DEFAULT_ATTACHMENT_KEYWORDS = [
  // English
  'invoice',
  'receipt',
  'statement',
  'billing',
  'payslip',

  // Portuguese
  'fatura',
  'factura',
  'recibo',
  'pagamento',
  'comprovativo',
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
