import { describe, it, expect } from 'vitest';
import * as s from './schema.js';

const ok = (schema, input) => schema.safeParse(input);

describe('signupSchema', () => {
  const body = { plan_slug: 'silver', member_type: 'INDIVIDUAL', full_name: 'Asha Rao', email: 'ASHA@Example.com', mobile: '9876543210', password: 'correct-horse' };
  it('accepts a valid sign-up and lower-cases the email', () => {
    const r = ok(s.signupSchema, { body });
    expect(r.success).toBe(true);
    expect(r.data.body.email).toBe('asha@example.com');
  });
  it('rejects a short password, bad mobile and bad GSTIN', () => {
    expect(ok(s.signupSchema, { body: { ...body, password: 'short' } }).success).toBe(false);
    expect(ok(s.signupSchema, { body: { ...body, mobile: '12ab' } }).success).toBe(false);
    expect(ok(s.signupSchema, { body: { ...body, gstin: 'NOPE' } }).success).toBe(false);
  });
  it('strips fields it does not know (no role or permission injection)', () => {
    expect(ok(s.signupSchema, { body: { ...body, roles: ['admin'] } }).data.body.roles).toBeUndefined();
  });
});

describe('plan schemas', () => {
  it('price amounts must be whole paise', () => {
    expect(ok(s.priceCreateSchema, { params: { id: 'p' }, body: { interval: 'YEARLY', amount: 99900 } }).success).toBe(true);
    expect(ok(s.priceCreateSchema, { params: { id: 'p' }, body: { interval: 'YEARLY', amount: 99.5 } }).success).toBe(false);
    expect(ok(s.priceCreateSchema, { params: { id: 'p' }, body: { interval: 'WEEKLY', amount: 1 } }).success).toBe(false);
  });
  it('plan slug is a url-safe slug', () => {
    expect(ok(s.planCreateSchema, { body: { slug: 'Bad Slug', name: 'x' } }).success).toBe(false);
    expect(ok(s.planCreateSchema, { body: { slug: 'gold-plus', name: 'Gold Plus' } }).success).toBe(true);
  });
});

describe('admin schemas', () => {
  it('extend needs days or until', () => {
    expect(ok(s.extendSchema, { params: { id: 'm' }, body: {} }).success).toBe(false);
    expect(ok(s.extendSchema, { params: { id: 'm' }, body: { days: 30 } }).success).toBe(true);
  });
  it('member list filters coerce query strings', () => {
    const r = ok(s.memberListSchema, { query: { page: '2', limit: '50', status: 'ACTIVE', member_since_from: '2026-01-01' } });
    expect(r.data.query).toMatchObject({ page: 2, limit: 50, status: 'ACTIVE' });
    expect(r.data.query.member_since_from).toBeInstanceOf(Date);
    expect(ok(s.memberListSchema, { query: { status: 'BOGUS' } }).success).toBe(false);
  });
  it('rejection needs a reason; refund is optional', () => {
    expect(ok(s.approvalRejectSchema, { params: { subscriptionId: 'a' }, body: {} }).success).toBe(false);
    expect(ok(s.approvalRejectSchema, { params: { subscriptionId: 'a' }, body: { reason: 'Not eligible', refund: true } }).success).toBe(true);
  });
  it('preset must be one of the seven', () => {
    expect(ok(s.presetApplySchema, { body: { preset: 'Club' } }).success).toBe(true);
    expect(ok(s.presetApplySchema, { body: { preset: 'Nope' } }).success).toBe(false);
  });
  it('provider body takes write-only credentials', () => {
    expect(ok(s.providerCreateSchema, { body: { provider: 'razorpay', label: 'Razorpay', credentials: { key_id: 'k', key_secret: 's' } } }).data.body.provider).toBe('RAZORPAY');
  });
});

describe('import row', () => {
  it('normalises phone, type and tags', () => {
    const r = s.importRowSchema.safeParse({ full_name: 'A', email: 'a@b.co', mobile: '98765 43210', member_type: 'organisation', tags: 'vip; early' });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ mobile: '9876543210', member_type: 'ORGANISATION', tags: ['vip', 'early'] });
  });
  it('flags a bad email', () => expect(s.importRowSchema.safeParse({ full_name: 'A', email: 'nope' }).success).toBe(false));
});
