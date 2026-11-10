// What the provider form offers per provider. One place; the form renders from this.
export interface ProviderPreset {
  type: 'GATEWAY' | 'MANUAL'
  label: string
  options?: Array<{ key: string; label: string }>
  manual?: Array<{ key: string; label: string; textarea?: boolean }>
}

const GATEWAY_OPTIONS = [
  { key: 'upi', label: 'UPI' },
  { key: 'cards', label: 'Cards' },
  { key: 'netbanking', label: 'Netbanking' },
  { key: 'wallets', label: 'Wallets' },
  { key: 'emi', label: 'EMI' },
]

const gateway = (label: string, options = GATEWAY_OPTIONS): ProviderPreset => ({
  type: 'GATEWAY',
  label,
  options,
})

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  RAZORPAY: gateway('Razorpay'),
  STRIPE: gateway('Stripe', [{ key: 'cards', label: 'Cards' }]),
  PAYPAL: gateway('PayPal', []),
  PHONEPE: gateway('PhonePe'),
  CASHFREE: gateway('Cashfree'),
  PAYU: gateway('PayU'),
  CCAVENUE: gateway('CCAvenue'),
  BANK_TRANSFER: {
    type: 'MANUAL',
    label: 'Bank transfer',
    manual: [
      { key: 'bank_name', label: 'Bank name' },
      { key: 'account_name', label: 'Account name' },
      { key: 'account_number', label: 'Account number' },
      { key: 'ifsc', label: 'IFSC' },
      { key: 'upi_id', label: 'UPI ID' },
      { key: 'pay_within_days', label: 'Pay within (days)' },
      { key: 'instructions', label: 'Instructions shown to the member', textarea: true },
    ],
  },
  CHEQUE: {
    type: 'MANUAL',
    label: 'Cheque',
    manual: [
      { key: 'payable_to', label: 'Payable to' },
      { key: 'instructions', label: 'Instructions', textarea: true },
    ],
  },
  CASH: {
    type: 'MANUAL',
    label: 'Cash',
    manual: [{ key: 'instructions', label: 'Instructions', textarea: true }],
  },
  CUSTOM: {
    type: 'MANUAL',
    label: 'Custom method',
    manual: [{ key: 'instructions', label: 'Instructions', textarea: true }],
  },
}
