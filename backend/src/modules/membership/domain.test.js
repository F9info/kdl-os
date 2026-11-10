import { describe, it, expect } from 'vitest';
import {
  calcPrice, taxPortionOfTotal, periodEnd, canTransition, assertTransition, statusAfterPayment, signupOutcome,
  pickCurrentSubscription, proRataCredit, financialYear, invoiceNumber, memberNumber, paymentReference,
  eligibleProviders, ruleMatches, checkAccess, sweepDecisions, validateFieldValues, toValueColumns,
} from './domain.js';

describe('calcPrice', () => {
  it('adds GST on top when EXCLUSIVE', () => {
    expect(calcPrice({ amount: 100000, gst_rate: 18, tax_mode: 'EXCLUSIVE' })).toEqual({ subtotal: 100000, tax: 18000, total: 118000 });
  });
  it('splits GST out of the amount when INCLUSIVE', () => {
    expect(calcPrice({ amount: 118000, gst_rate: 18, tax_mode: 'INCLUSIVE' })).toEqual({ subtotal: 100000, tax: 18000, total: 118000 });
  });
  it('always sums to the total with odd paise', () => {
    const r = calcPrice({ amount: 99999, gst_rate: 18, tax_mode: 'INCLUSIVE' });
    expect(r.subtotal + r.tax).toBe(99999);
    expect(Number.isInteger(r.tax)).toBe(true);
  });
  it('handles zero and rejects bad money', () => {
    expect(calcPrice({ amount: 0, gst_rate: 18 }).total).toBe(0);
    expect(() => calcPrice({ amount: 10.5 })).toThrow();
    expect(() => calcPrice({ amount: -1 })).toThrow();
  });
  it('taxPortionOfTotal matches INCLUSIVE tax', () => {
    expect(taxPortionOfTotal(118000, 18)).toBe(18000);
  });
});

describe('periodEnd', () => {
  const d = (s) => new Date(s);
  it('adds months by interval', () => {
    expect(periodEnd(d('2026-01-15T00:00:00Z'), 'MONTHLY').toISOString()).toBe('2026-02-15T00:00:00.000Z');
    expect(periodEnd(d('2026-01-15T00:00:00Z'), 'QUARTERLY').toISOString()).toBe('2026-04-15T00:00:00.000Z');
    expect(periodEnd(d('2026-01-15T00:00:00Z'), 'HALF_YEARLY').toISOString()).toBe('2026-07-15T00:00:00.000Z');
    expect(periodEnd(d('2026-01-15T00:00:00Z'), 'YEARLY').toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });
  it('clamps month ends', () => {
    expect(periodEnd(d('2026-01-31T00:00:00Z'), 'MONTHLY').toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(periodEnd(d('2028-02-29T00:00:00Z'), 'YEARLY').toISOString()).toBe('2029-02-28T00:00:00.000Z');
  });
  it('lifetime has no end', () => expect(periodEnd(new Date(), 'LIFETIME')).toBeNull());
});

describe('status machine', () => {
  it('allows the documented path', () => {
    for (const [a, b] of [['PENDING_PAYMENT', 'PENDING_APPROVAL'], ['PENDING_PAYMENT', 'ACTIVE'], ['PENDING_APPROVAL', 'ACTIVE'], ['PENDING_APPROVAL', 'REJECTED'], ['ACTIVE', 'PAST_DUE'], ['PAST_DUE', 'EXPIRED'], ['ACTIVE', 'SUSPENDED'], ['SUSPENDED', 'ACTIVE'], ['EXPIRED', 'ACTIVE']])
      expect(canTransition(a, b)).toBe(true);
  });
  it('blocks the rest, and terminal states', () => {
    expect(canTransition('PENDING_PAYMENT', 'EXPIRED')).toBe(false);
    expect(canTransition('CANCELLED', 'ACTIVE')).toBe(false);
    expect(canTransition('REJECTED', 'ACTIVE')).toBe(false);
    expect(() => assertTransition('CANCELLED', 'ACTIVE')).toThrow(/Cannot change/);
  });
  it('payment outcome follows approval mode', () => {
    expect(statusAfterPayment({ approval_mode: 'MANUAL' })).toBe('PENDING_APPROVAL');
    expect(statusAfterPayment({ approval_mode: 'AUTO' })).toBe('ACTIVE');
  });
  it('signup outcome', () => {
    expect(signupOutcome({ is_free: false, approval_mode: 'AUTO' }).next).toBe('checkout');
    expect(signupOutcome({ is_free: true, approval_mode: 'AUTO' })).toEqual({ status: 'ACTIVE', next: 'active' });
    expect(signupOutcome({ is_free: true, approval_mode: 'MANUAL' })).toEqual({ status: 'PENDING_APPROVAL', next: 'approval' });
  });
  it('picks the running subscription over a pending upgrade', () => {
    const cur = pickCurrentSubscription([
      { id: 'a', status: 'PENDING_PAYMENT', created_at: '2026-02-01' },
      { id: 'b', status: 'ACTIVE', created_at: '2026-01-01' },
    ]);
    expect(cur.id).toBe('b');
    expect(pickCurrentSubscription([])).toBeNull();
  });
});

describe('proRataCredit', () => {
  it('credits the unused days', () => {
    const credit = proRataCredit({ paid_total: 120000, starts_at: '2026-01-01T00:00:00Z', ends_at: '2026-01-31T00:00:00Z', now: new Date('2026-01-16T00:00:00Z') });
    expect(credit).toBe(60000);
  });
  it('is zero for lifetime, expired and unpaid', () => {
    expect(proRataCredit({ paid_total: 1000, starts_at: '2026-01-01', ends_at: null })).toBe(0);
    expect(proRataCredit({ paid_total: 1000, starts_at: '2026-01-01', ends_at: '2026-02-01', now: new Date('2026-03-01') })).toBe(0);
    expect(proRataCredit({ paid_total: 0, starts_at: '2026-01-01', ends_at: '2026-02-01' })).toBe(0);
  });
  it('never credits more than was paid', () => {
    const c = proRataCredit({ paid_total: 5000, starts_at: '2026-01-10', ends_at: '2026-02-10', now: new Date('2026-01-01') });
    expect(c).toBe(5000);
  });
});

describe('numbering', () => {
  it('financial year runs April to March in IST', () => {
    expect(financialYear(new Date('2026-04-01T00:00:00+05:30'))).toBe('2026-27');
    expect(financialYear(new Date('2026-03-31T23:59:00+05:30'))).toBe('2025-26');
    expect(financialYear(new Date('2026-03-31T19:00:00Z'))).toBe('2026-27'); // already 1 Apr in IST
    expect(financialYear(new Date('2099-06-01T00:00:00Z'))).toBe('2099-00');
  });
  it('formats numbers', () => {
    expect(invoiceNumber('2026-27', 7)).toBe('MEM/2026-27/00007');
    expect(invoiceNumber('2026-27', 7, true)).toBe('MEM-CN/2026-27/00007');
    expect(memberNumber(2026, 12)).toBe('KDL-M-2026-00012');
    expect(paymentReference(3)).toBe('KDL-PAY-00003');
  });
});

describe('eligibleProviders', () => {
  const base = { status: 'PUBLISHED', plans: [], member_types: [], regions: 'INDIA', min_amount: null, max_amount: null, sort: 0 };
  const list = [
    { ...base, id: 'draft', status: 'DRAFT' },
    { ...base, id: 'all', sort: 2 },
    { ...base, id: 'gold-only', plans: [{ plan_id: 'gold' }], sort: 1 },
    { ...base, id: 'orgs', member_types: ['ORGANISATION'], sort: 3 },
    { ...base, id: 'usd', regions: 'OUTSIDE_INDIA' },
    { ...base, id: 'big', min_amount: 500000, sort: 4 },
    { ...base, id: 'small', max_amount: 1000, sort: 5 },
    { ...base, id: 'any-region', regions: 'ALL', sort: 6 },
  ];
  it('filters by status, plan, member type, region and amount, in admin order', () => {
    const ids = (ctx) => eligibleProviders(list, ctx).map((p) => p.id);
    expect(ids({ planId: 'silver', memberType: 'INDIVIDUAL', amount: 50000 })).toEqual(['all', 'any-region']);
    expect(ids({ planId: 'gold', memberType: 'ORGANISATION', amount: 600000 })).toEqual(['gold-only', 'all', 'orgs', 'big', 'any-region']);
    expect(ids({ planId: 'x', memberType: 'INDIVIDUAL', region: 'OUTSIDE_INDIA', amount: 500 })).toEqual(['usd', 'any-region']);
  });
});

describe('access rules', () => {
  const silver = { id: 's', slug: 'silver', name: 'Silver', tier: 2 };
  const gold = { id: 'g', slug: 'gold', name: 'Gold', tier: 3 };
  const free = { id: 'f', slug: 'free', name: 'Free', tier: 1 };
  const rules = [
    { target: 'PAGE', value: 'reports', plan: silver },
    { target: 'URL_PATTERN', value: '/members/gold/*', plan: gold },
    { target: 'MEDIA', value: 'media_9', plan: silver },
  ];
  it('matches by target', () => {
    expect(ruleMatches(rules[0], '/p/reports')).toBe(true);
    expect(ruleMatches(rules[0], '/reports?x=1')).toBe(true);
    expect(ruleMatches(rules[1], '/members/gold/a/b')).toBe(true);
    expect(ruleMatches(rules[1], '/members/silver/a')).toBe(false);
    expect(ruleMatches(rules[2], '/media/media_9')).toBe(true);
  });
  it('open when no rule covers the path', () => expect(checkAccess(rules, '/about', free)).toEqual({ allowed: true }));
  it('locks lower tiers and names the plan required', () => {
    const r = checkAccess(rules, '/p/reports', free);
    expect(r.allowed).toBe(false);
    expect(r.plan_required.slug).toBe('silver');
    expect(checkAccess(rules, '/p/reports', null).allowed).toBe(false);
  });
  it('higher tier inherits lower tier access', () => {
    expect(checkAccess(rules, '/p/reports', gold).allowed).toBe(true);
    expect(checkAccess(rules, '/members/gold/x', silver).allowed).toBe(false);
  });
});

describe('sweepDecisions', () => {
  const now = new Date('2026-03-10T00:00:00Z');
  it('moves ACTIVE past end to PAST_DUE with 7-day grace, PAST_DUE past grace to EXPIRED', () => {
    const out = sweepDecisions(
      [
        { id: '1', status: 'ACTIVE', ends_at: '2026-03-01T00:00:00Z' },
        { id: '2', status: 'ACTIVE', ends_at: '2026-04-01T00:00:00Z' },
        { id: '3', status: 'ACTIVE', ends_at: null },
        { id: '4', status: 'PAST_DUE', grace_ends_at: '2026-03-09T00:00:00Z' },
        { id: '5', status: 'PAST_DUE', grace_ends_at: '2026-03-12T00:00:00Z' },
        { id: '6', status: 'ACTIVE', ends_at: '2026-03-01T00:00:00Z', cancel_at_period_end: true },
      ],
      now,
      7
    );
    expect(out.map((o) => [o.id, o.to])).toEqual([['1', 'PAST_DUE'], ['4', 'EXPIRED'], ['6', 'CANCELLED']]);
    expect(out[0].data.grace_ends_at.toISOString()).toBe('2026-03-08T00:00:00.000Z');
  });
});

describe('field values', () => {
  const fields = [
    { key: 'gstin', label: 'GSTIN', type: 'GSTIN', required: true },
    { key: 'pin', label: 'Pincode', type: 'PINCODE' },
    { key: 'size', label: 'Size', type: 'SELECT', options: ['S', 'M'] },
  ];
  it('flags required, format and options', () => {
    expect(validateFieldValues(fields, { gstin: '36ABCDE1234F1Z5', pin: '500001', size: 'S' })).toEqual({});
    expect(Object.keys(validateFieldValues(fields, { pin: '12', size: 'XL' })).sort()).toEqual(['gstin', 'pin', 'size']);
    expect(validateFieldValues(fields, { gstin: '36abcde1234f1z5' })).toEqual({});
  });
  it('maps types to value columns', () => {
    expect(toValueColumns('NUMBER', '4').value_num).toBe(4);
    expect(toValueColumns('BOOLEAN', 'true').value_bool).toBe(true);
    expect(toValueColumns('PAN', 'abcde1234f').value_text).toBe('ABCDE1234F');
    expect(toValueColumns('TEXT', '').value_text).toBeNull();
  });
});

import { allowsMemberType } from './domain.js';
describe('allowsMemberType', () => {
  it('empty list means everyone', () => {
    expect(allowsMemberType({ member_types: [] }, 'ORGANISATION')).toBe(true);
    expect(allowsMemberType({ member_types: ['INDIVIDUAL'] }, 'ORGANISATION')).toBe(false);
  });
});
