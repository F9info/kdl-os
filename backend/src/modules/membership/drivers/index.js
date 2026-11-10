// Payment driver registry. A driver is:
//   {
//     key, type: 'GATEWAY' | 'MANUAL',
//     createOrder({ amount, currency, receipt, notes }, creds)   -> { order_id, ...clientPayload }
//     verifyWebhook({ rawBody, signature }, secret)               -> boolean
//     parseWebhook(body)                                          -> { external_id?, type, order_id, payment_id, amount } | null
//     verifyCheckout({ order_id, payment_id, signature }, creds)  -> boolean
//     refund({ payment_id, amount }, creds)                       -> { refund_id }
//     test(creds)                                                 -> { ok, message }
//   }
// To add a gateway: write drivers/<name>.js and register it below.
import razorpay from './razorpay.js';
import { manualDriver } from './manual.js';

const MANUAL_KEYS = ['BANK_TRANSFER', 'CHEQUE', 'CASH'];
const KNOWN_GATEWAYS = ['STRIPE', 'PAYPAL', 'PHONEPE', 'CASHFREE', 'PAYU', 'CCAVENUE', 'CUSTOM'];

const registry = { RAZORPAY: razorpay };
for (const k of MANUAL_KEYS) registry[k] = { ...manualDriver, key: k };

export function getDriver(providerKey) {
  const key = String(providerKey).toUpperCase();
  if (registry[key]) return registry[key];
  const err = new Error(
    KNOWN_GATEWAYS.includes(key)
      ? `Payment driver for ${key} is not implemented yet`
      : `Unknown payment provider ${key}`
  );
  err.status = 501;
  throw err;
}

export const isManualProvider = (providerKey) => MANUAL_KEYS.includes(String(providerKey).toUpperCase());
export const implementedProviders = () => Object.keys(registry);
