// constants.js
// Static defaults — keyword lists, label names, limits.
// All runtime config comes from Script Properties (config.js).

var LABEL_NAMES = {
  CANDIDATE:  'gmail-smart-forward/candidate',
  FORWARDED:  'gmail-smart-forward/forwarded',
  REJECTED:   'gmail-smart-forward/rejected',
  DISCOVERED: 'gmail-smart-forward/discovered',
};

var DEFAULT_SUBJECT_KEYWORDS = [
  // ── English ──────────────────────────────────────────────────────────────
  'invoice',
  'receipt',
  'tax invoice',
  'proforma',
  'pro forma',
  'credit note',
  'debit note',
  'remittance',
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

  // ── French ────────────────────────────────────────────────────────────────
  'facture',              // invoice
  'reçu',                 // receipt
  'avoir',                // credit note
  'note de crédit',       // credit note
  'note de débit',        // debit note
  'relevé',               // statement
  'bulletin de salaire',  // payslip
  'bulletin de paie',     // payslip
  'fiche de paie',        // payslip
  'confirmation de paiement', // payment confirmation
  'rappel de paiement',   // payment reminder
  'avis de paiement',     // payment notice
  'bon de commande',      // purchase order

  // ── Spanish ───────────────────────────────────────────────────────────────
  'factura',              // invoice
  'recibo',               // receipt
  'nota de crédito',      // credit note
  'nota de débito',       // debit note
  'comprobante',          // proof / receipt
  'estado de cuenta',     // account statement
  'nómina',               // payslip / payroll
  'confirmación de pago', // payment confirmation
  'recordatorio de pago', // payment reminder
  'aviso de pago',        // payment notice
  'orden de compra',      // purchase order
  'liquidación',          // settlement

  // ── Portuguese ────────────────────────────────────────────────────────────
  'fatura',               // invoice (current spelling)
  'factura',              // invoice (old spelling, still common)
  'talão',                // receipt slip
  'nota de débito',       // debit note
  'nota de crédito',      // credit note
  'pagamento',            // payment
  'comprovativo',         // proof / confirmation of payment
  'confirmação de pagamento', // payment confirmation
  'aviso de pagamento',   // payment notice
  'aviso',                // notice
  'recibo de vencimento', // payslip
  'recibo de salário',    // payslip
  'vencimento',           // salary / due date
  'salário',              // salary
  'ordenado',             // salary (colloquial PT)
  'contra-recibo',        // pay stub
  'entrega dos serviços', // delivery of services
  'prestação de serviços',// service provision
  'documento fiscal',     // fiscal document
  'extrato',              // statement / extract
  'nota de encomenda',    // purchase order

  // ── German ────────────────────────────────────────────────────────────────
  'rechnung',             // invoice
  'quittung',             // receipt
  'beleg',                // receipt / document
  'gutschrift',           // credit note
  'lastschrift',          // debit / direct debit
  'kontoauszug',          // account statement
  'gehaltsabrechnung',    // payslip
  'lohnabrechnung',       // payslip
  'zahlungsbestätigung',  // payment confirmation
  'zahlungserinnerung',   // payment reminder
  'mahnung',              // dunning / overdue notice
  'auftragsbestätigung',  // order confirmation
  'lieferschein',         // delivery note

  // ── Chinese (Simplified) ─────────────────────────────────────────────────
  '发票',    // fāpiào — invoice / official tax receipt
  '收据',    // shōujù — receipt
  '账单',    // zhàngdān — bill / invoice
  '付款确认', // fùkuǎn quèrèn — payment confirmation
  '工资单',  // gōngzī dān — payslip
  '订单确认', // dìngdān quèrèn — order confirmation
  '对账单',  // duìzhàng dān — statement of account

  // ── Japanese ─────────────────────────────────────────────────────────────
  '請求書',  // seikyūsho — invoice
  '領収書',  // ryōshūsho — receipt
  '納品書',  // nōhinsho — delivery note
  '支払確認', // shiharai kakunin — payment confirmation
  '給与明細', // kyūyo meisai — payslip
  '注文確認', // chūmon kakunin — order confirmation
];

var DEFAULT_ATTACHMENT_KEYWORDS = [
  // English
  'invoice',
  'receipt',
  'statement',
  'billing',
  'payslip',

  // French
  'facture',
  'recu',
  'bulletin-de-paie',

  // Spanish
  'factura',
  'comprobante',
  'nomina',

  // Portuguese
  'fatura',
  'factura',
  'recibo',
  'pagamento',
  'comprovativo',

  // German
  'rechnung',
  'quittung',
  'gehaltsabrechnung',

  // Chinese
  '发票',
  '收据',

  // Japanese
  '請求書',
  '領収書',
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

// File extensions that count as valid invoice attachments.
// Compared case-insensitively against attachment filenames.
var DEFAULT_ATTACHMENT_EXTENSIONS = ['pdf'];

var DEFAULT_DISCOVERY_DAYS = 365;
var DEFAULT_MAX_EMAILS_PER_RUN = 50;
var DEFAULT_DRY_RUN = true;
