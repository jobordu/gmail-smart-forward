/* exported LABEL_NAMES, DEFAULT_SUBJECT_KEYWORDS, DEFAULT_ATTACHMENT_KEYWORDS, DEFAULT_EXCLUDED_KEYWORDS, DEFAULT_ATTACHMENT_EXTENSIONS, DEFAULT_DISCOVERY_DAYS, DEFAULT_MAX_EMAILS_PER_RUN, DEFAULT_DRY_RUN */
// constants.js
// Static defaults — keyword lists, label names, limits.
// All runtime config comes from Script Properties (config.js).

var LABEL_NAMES = {
  CANDIDATE:  'gmail-smart-forward/candidate',
  FORWARDED:  'gmail-smart-forward/forwarded',
  REJECTED:   'gmail-smart-forward/rejected',
  DISCOVERED: 'gmail-smart-forward/discovered',
};

// Default keyword vocabulary for a company tracking its own outgoing spend:
// supplier invoices, subscription renewals, purchase receipts, payslips.
// These match emails where YOUR COMPANY is the payer / buyer.
var DEFAULT_SUBJECT_KEYWORDS = [
  // ── English ──────────────────────────────────────────────────────────────
  'invoice',
  'your invoice',
  'tax invoice',
  'proforma invoice',
  'pro forma invoice',
  'receipt',
  'your receipt',
  'payment receipt',
  'payment confirmation',
  'payment due',
  'amount due',
  'balance due',
  'payment reminder',
  'credit note',
  'debit note',
  'your order',
  'order confirmation',
  'purchase confirmation',
  'your purchase',
  'your subscription',
  'subscription renewal',
  'subscription receipt',
  'auto-renewal',
  'renewal confirmation',
  'your bill',
  'billing',
  'charge confirmation',
  'transaction receipt',
  'expense',
  'payslip',
  'pay slip',
  'salary',
  'payroll',
  'remittance',

  // ── French ────────────────────────────────────────────────────────────────
  'facture',                  // invoice
  'votre facture',            // your invoice
  'reçu',                     // receipt
  'votre reçu',               // your receipt
  'confirmation de paiement', // payment confirmation
  'rappel de paiement',       // payment reminder
  'avis de paiement',         // payment notice
  'votre commande',           // your order
  'confirmation de commande', // order confirmation
  'votre achat',              // your purchase
  'votre abonnement',         // your subscription
  'renouvellement',           // renewal
  'avoir',                    // credit note
  'note de crédit',           // credit note
  'note de débit',            // debit note
  'bulletin de salaire',      // payslip
  'bulletin de paie',         // payslip
  'fiche de paie',            // payslip
  'note de frais',            // expense report

  // ── Spanish ───────────────────────────────────────────────────────────────
  'factura',                  // invoice
  'su factura',               // your invoice
  'recibo',                   // receipt
  'su recibo',                // your receipt
  'confirmación de pago',     // payment confirmation
  'recordatorio de pago',     // payment reminder
  'aviso de pago',            // payment notice
  'su pedido',                // your order
  'confirmación de pedido',   // order confirmation
  'su compra',                // your purchase
  'su suscripción',           // your subscription
  'renovación',               // renewal
  'comprobante',              // proof / receipt
  'nota de crédito',          // credit note
  'nota de débito',           // debit note
  'nómina',                   // payslip / payroll
  'gasto',                    // expense

  // ── Portuguese ────────────────────────────────────────────────────────────
  'fatura',                   // invoice (current spelling)
  'factura',                  // invoice (old spelling, still common)
  'a sua fatura',             // your invoice
  'talão',                    // receipt slip
  'comprovativo',             // proof / confirmation of payment
  'confirmação de pagamento', // payment confirmation
  'aviso de pagamento',       // payment notice
  'nota de débito',           // debit note
  'nota de crédito',          // credit note
  'a sua encomenda',          // your order
  'confirmação de encomenda', // order confirmation
  'a sua subscrição',         // your subscription
  'renovação',                // renewal
  'recibo de vencimento',     // payslip
  'recibo de salário',        // payslip
  'vencimento',               // salary / due date
  'salário',                  // salary
  'ordenado',                 // salary (colloquial PT)
  'contra-recibo',            // pay stub
  'despesa',                  // expense
  'nota de encomenda',        // purchase order

  // ── German ────────────────────────────────────────────────────────────────
  'rechnung',                 // invoice
  'ihre rechnung',            // your invoice
  'quittung',                 // receipt
  'zahlungsbestätigung',      // payment confirmation
  'zahlungserinnerung',       // payment reminder
  'ihre bestellung',          // your order
  'auftragsbestätigung',      // order confirmation
  'ihr abonnement',           // your subscription
  'verlängerung',             // renewal
  'gutschrift',               // credit note
  'lastschrift',              // direct debit
  'gehaltsabrechnung',        // payslip
  'lohnabrechnung',           // payslip
  'spesenabrechnug',          // expense report
  'mahnung',                  // dunning / overdue notice
  'beleg',                    // receipt / document

  // ── Chinese (Simplified) ─────────────────────────────────────────────────
  '发票',      // fāpiào — invoice / official tax receipt
  '收据',      // shōujù — receipt
  '账单',      // zhàngdān — bill / invoice
  '付款确认',   // fùkuǎn quèrèn — payment confirmation
  '付款提醒',   // fùkuǎn tíxǐng — payment reminder
  '您的订单',   // nín de dìngdān — your order
  '订单确认',   // dìngdān quèrèn — order confirmation
  '您的订阅',   // nín de dìngyuè — your subscription
  '续费',      // xùfèi — renewal / subscription renewal
  '工资单',    // gōngzī dān — payslip
  '费用',      // fèiyòng — expense / charge

  // ── Japanese ─────────────────────────────────────────────────────────────
  '請求書',    // seikyūsho — invoice
  '領収書',    // ryōshūsho — receipt
  'お支払い確認', // o-shiharai kakunin — payment confirmation
  'お支払いのご案内', // payment notice
  'ご注文確認', // go-chūmon kakunin — order confirmation
  'ご購入',    // go-kōnyū — your purchase
  'サブスクリプション', // subscription
  '自動更新',  // jidō kōshin — auto-renewal
  '給与明細',  // kyūyo meisai — payslip
  '経費',      // keihi — expense
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
