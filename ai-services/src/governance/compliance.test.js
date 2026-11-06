import { describe, it, expect } from 'vitest';
import { scrubInput } from './compliance.js';

describe('scrubInput: Indian PII', () => {
  it.each([
    ['Aadhaar spaced', 'id 2345 6789 0123 ok', 'id [AADHAAR] ok'],
    ['Aadhaar dashed', 'id 2345-6789-0123', 'id [AADHAAR]'],
    ['Aadhaar plain', 'id 234567890123.', 'id [AADHAAR].'],
    ['PAN upper', 'PAN ABCDE1234F here', 'PAN [PAN] here'],
    ['PAN lower', 'pan abcde1234f', 'pan [PAN]'],
    ['mobile +91', 'call +91 98765 43210 now', 'call [PHONE] now'],
    ['mobile +91 joined', 'call +919876543210', 'call [PHONE]'],
    ['mobile bare', 'call 9876543210', 'call [PHONE]'],
    ['mobile 0 prefix', 'call 09876543210', 'call [PHONE]'],
    ['mobile split', 'call 98765-43210', 'call [PHONE]'],
  ])('%s', (_n, input, expected) => {
    expect(scrubInput(input)).toBe(expected);
  });

  it('leaves ordinary text and Indian-style amounts alone', () => {
    const s = 'Invoice total Rs 1,00,000 due on 06-11-2026 for ABCDE (5 items) in Hyderabad 500001';
    expect(scrubInput(s)).toBe(s);
  });

  it('a 16-digit card is one [CC], not split by the Aadhaar pattern', () => {
    const out = scrubInput('card 4111 1111 1111 1111 end');
    expect(out).toContain('[CC]');
    expect(out).not.toMatch(/AADHAAR|\d/);
  });

  it('still scrubs the original formats', () => {
    expect(scrubInput('mail a@b.com ssn 123-45-6789')).toBe('mail [EMAIL] ssn [SSN]');
  });
});
