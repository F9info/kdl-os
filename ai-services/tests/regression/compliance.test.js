import { describe, it, expect } from 'vitest';
import { scrubInput, scrubMessages } from '../../src/governance/compliance.js';

describe('PII scrubbing regression', () => {
  it('removes email, phone, credit card, and SSN patterns (regression M3/KDL-26)', () => {
    const input = 'Contact me at alice@example.com or 555-123-4567. My SSN is 123-45-6789 and card 4111 1111 1111 1111.';
    const out = scrubInput(input);
    expect(out).not.toContain('alice@example.com');
    expect(out).not.toContain('555-123-4567');
    expect(out).not.toContain('123-45-6789');
    expect(out).not.toContain('4111 1111 1111 1111');
    expect(out).toContain('[EMAIL]');
    expect(out).toContain('[PHONE]');
    expect(out).toContain('[SSN]');
    expect(out).toContain('[CC]');
  });

  it('scrubs message arrays without mutating original shape', () => {
    const messages = [{ role: 'user', content: 'reach me at alice@example.com' }];
    const out = scrubMessages(messages);
    expect(out[0].content).toBe('reach me at [EMAIL]');
    expect(out[0].role).toBe('user');
  });
});
