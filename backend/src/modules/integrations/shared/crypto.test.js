import { describe, it, expect, vi, afterEach } from 'vitest';

const KEY_A = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const KEY_B = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

const ORIGINAL_KEY = process.env.APP_ENCRYPTION_KEY;

async function loadCrypto(keyHex) {
  vi.resetModules();
  if (keyHex === undefined) {
    delete process.env.APP_ENCRYPTION_KEY;
  } else {
    process.env.APP_ENCRYPTION_KEY = keyHex;
  }
  return import('./crypto.js');
}

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.APP_ENCRYPTION_KEY;
  } else {
    process.env.APP_ENCRYPTION_KEY = ORIGINAL_KEY;
  }
});

describe('integrations crypto', () => {
  it('round-trips plaintext through encrypt/decrypt', async () => {
    const { encrypt, decrypt } = await loadCrypto(KEY_A);
    const plaintext = JSON.stringify({ apiKey: 'secret-value', authToken: 'tok_123' });
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toContain('secret-value');
    expect(encrypted.split(':')).toHaveLength(3);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', async () => {
    const { encrypt, decrypt } = await loadCrypto(KEY_A);
    const first = encrypt('same input');
    const second = encrypt('same input');
    expect(first).not.toBe(second);
    expect(decrypt(first)).toBe('same input');
    expect(decrypt(second)).toBe('same input');
  });

  it('throws when decrypting with a different key', async () => {
    const { encrypt } = await loadCrypto(KEY_A);
    const encrypted = encrypt('cross-key payload');
    const { decrypt } = await loadCrypto(KEY_B);
    expect(() => decrypt(encrypted)).toThrow();
  });

  it('throws at import when APP_ENCRYPTION_KEY is missing', async () => {
    await expect(loadCrypto(undefined)).rejects.toThrow('APP_ENCRYPTION_KEY');
  });

  it('throws at import when APP_ENCRYPTION_KEY is not 32-byte hex', async () => {
    await expect(loadCrypto('too-short')).rejects.toThrow('32-byte hex');
  });

  it('throws on malformed payload format', async () => {
    const { decrypt } = await loadCrypto(KEY_A);
    expect(() => decrypt('not-a-valid-payload')).toThrow('Invalid encrypted payload format');
  });
});
