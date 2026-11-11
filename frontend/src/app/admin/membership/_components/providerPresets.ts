// What the provider screens offer per provider. One place: the list, the add picker and the editor render from this.
export interface ProviderPreset {
  type: 'GATEWAY' | 'MANUAL'
  label: string
  /** Add-picker line, e.g. "India · UPI, cards, netbanking". */
  tag: string
  /** Badge colour + letter in lists. */
  color: string
  letter: string
  /** Key field labels in the Credentials card (gateways). */
  keyLabels?: { id: string; secret: string }
  options?: Array<{ key: string; label: string; hint?: string }>
  /** Manual method fields shown as "<Method> details". */
  manual?: Array<{ key: string; label: string; textarea?: boolean; hint?: string }>
  /** Gateways that are not built yet can be saved as draft but not published. */
  built?: boolean
}

const UPI_OPTIONS = [
  { key: 'upi', label: 'UPI', hint: 'Intent, QR and collect request' },
  { key: 'cards', label: 'Cards', hint: 'Visa, Mastercard, RuPay, Amex' },
  { key: 'netbanking', label: 'Netbanking', hint: 'All major banks' },
  { key: 'wallets', label: 'Wallets', hint: 'Paytm, PhonePe, Amazon Pay' },
  { key: 'emi', label: 'EMI', hint: 'Card and cardless EMI' },
]

const gateway = (
  label: string,
  tag: string,
  color: string,
  options: ProviderPreset['options'] = UPI_OPTIONS,
  keyLabels = { id: 'Key ID', secret: 'Key secret' },
  built = false
): ProviderPreset => ({
  type: 'GATEWAY',
  label,
  tag,
  color,
  letter: label.slice(0, 1),
  options,
  keyLabels,
  built,
})

const manual = (label: string, tag: string, fields: ProviderPreset['manual']): ProviderPreset => ({
  type: 'MANUAL',
  label,
  tag,
  color: '#64748b',
  letter: label.slice(0, 1),
  manual: fields,
  built: true,
})

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  RAZORPAY: { ...gateway('Razorpay', 'India · UPI, cards, netbanking', '#0C2451'), built: true },
  STRIPE: {
    ...gateway(
      'Stripe',
      'International cards, Apple / Google Pay',
      '#635BFF',
      [
        { key: 'cards', label: 'Cards', hint: 'Visa, Mastercard, Amex' },
        { key: 'apple_pay', label: 'Apple Pay', hint: 'Safari and iPhone' },
        { key: 'google_pay', label: 'Google Pay', hint: 'Chrome and Android' },
        { key: 'link', label: 'Link (saved cards)', hint: 'Stripe one-click checkout' },
      ],
      { id: 'Publishable key', secret: 'Secret key' }
    ),
  },
  PAYPAL: gateway('PayPal', 'International · PayPal & cards', '#003087', [], {
    id: 'Client ID',
    secret: 'Client secret',
  }),
  PHONEPE: gateway('PhonePe PG', 'India · UPI', '#5f259f'),
  CASHFREE: gateway('Cashfree', 'India · UPI, cards, netbanking', '#00a86b'),
  PAYU: gateway('PayU', 'India · cards, EMI', '#3da83a'),
  CCAVENUE: gateway('CCAvenue', 'India · 200+ options', '#e11d48'),
  BANK_TRANSFER: manual('Bank transfer', 'Manual · proof + verification', [
    { key: 'account_name', label: 'Account name' },
    { key: 'account_number', label: 'Account number' },
    { key: 'ifsc', label: 'IFSC' },
    { key: 'bank', label: 'Bank & branch' },
    { key: 'upi_id', label: 'UPI ID for transfer (optional)' },
    { key: 'instructions', label: 'Instructions', textarea: true },
  ]),
  CHEQUE: manual('Cheque / DD', 'Manual · verified by staff', [
    { key: 'payable_to', label: 'Payable to' },
    { key: 'instructions', label: 'Instructions', textarea: true },
  ]),
  CASH: manual('Cash at office', 'Manual · receipt number', [
    { key: 'instructions', label: 'Instructions', textarea: true },
  ]),
  CUSTOM: manual('Custom', 'Any other gateway or manual method', [
    { key: 'instructions', label: 'Instructions', textarea: true },
  ]),
}

/** Order of the Add-payment-method picker. */
export const PICKER_ORDER = [
  'RAZORPAY',
  'STRIPE',
  'PAYPAL',
  'PHONEPE',
  'CASHFREE',
  'PAYU',
  'CCAVENUE',
  'BANK_TRANSFER',
  'CHEQUE',
  'CASH',
  'CUSTOM',
]
