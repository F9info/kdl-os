import { describe, it, expect } from 'vitest';
import { apiRateLimitMax } from './api-rate-limit.js';

describe('apiRateLimitMax (requests per 15 minutes per client address on /api)', () => {
  it('production default is 1000 (100 was used up by one admin clicking around)', () => {
    expect(apiRateLimitMax({ NODE_ENV: 'production' })).toBe(1000);
  });

  it('development stays effectively off', () => {
    expect(apiRateLimitMax({ NODE_ENV: 'development' })).toBe(50000);
    expect(apiRateLimitMax({})).toBe(50000);
  });

  it('API_RATE_LIMIT overrides the default', () => {
    expect(apiRateLimitMax({ NODE_ENV: 'production', API_RATE_LIMIT: '2500' })).toBe(2500);
    expect(apiRateLimitMax({ NODE_ENV: 'development', API_RATE_LIMIT: '300' })).toBe(300);
  });

  it('ignores a value that is not a positive whole number', () => {
    for (const bad of ['', 'abc', '0', '-5', '12.5', ' ']) {
      expect(apiRateLimitMax({ NODE_ENV: 'production', API_RATE_LIMIT: bad })).toBe(1000);
    }
  });
});
