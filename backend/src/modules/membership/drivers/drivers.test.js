import { describe, it, expect } from 'vitest';
import { getDriver, isManualProvider, implementedProviders } from './index.js';
import razorpay, { hmacHex } from './razorpay.js';

describe('driver registry', () => {
  it('has razorpay and the manual drivers', () => {
    expect(implementedProviders()).toEqual(expect.arrayContaining(['RAZORPAY', 'BANK_TRANSFER', 'CHEQUE', 'CASH']));
    expect(getDriver('razorpay').type).toBe('GATEWAY');
    expect(isManualProvider('BANK_TRANSFER')).toBe(true);
    expect(isManualProvider('RAZORPAY')).toBe(false);
  });
  it('known but unbuilt gateways throw a clear error', () => {
    expect(() => getDriver('STRIPE')).toThrow(/not implemented/);
    expect(() => getDriver('NOPE')).toThrow(/Unknown payment provider/);
  });
});

describe('razorpay driver', () => {
  const secret = 'whsec_test';
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', amount: 5000 } } } });
  it('verifies the webhook HMAC over the raw body', () => {
    const sig = hmacHex(body, secret);
    expect(razorpay.verifyWebhook({ rawBody: Buffer.from(body), signature: sig }, secret)).toBe(true);
    expect(razorpay.verifyWebhook({ rawBody: Buffer.from(body + ' '), signature: sig }, secret)).toBe(false);
    expect(razorpay.verifyWebhook({ rawBody: Buffer.from(body), signature: 'x' }, secret)).toBe(false);
    expect(razorpay.verifyWebhook({ rawBody: Buffer.from(body), signature: sig }, '')).toBe(false);
  });
  it('parses a captured payment', () => {
    expect(razorpay.parseWebhook(JSON.parse(body))).toEqual({ type: 'payment.paid', order_id: 'order_1', payment_id: 'pay_1', amount: 5000 });
    expect(razorpay.parseWebhook({ event: 'something.else' })).toBeNull();
  });
  it('verifies the checkout signature', () => {
    const creds = { key_secret: 'sec' };
    const signature = hmacHex('order_1|pay_1', 'sec');
    expect(razorpay.verifyCheckout({ order_id: 'order_1', payment_id: 'pay_1', signature }, creds)).toBe(true);
    expect(razorpay.verifyCheckout({ order_id: 'order_1', payment_id: 'pay_2', signature }, creds)).toBe(false);
  });
});
