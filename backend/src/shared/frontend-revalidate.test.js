import { describe, it, expect, vi, afterEach } from 'vitest';
import { revalidateToken, revalidatePublicPages } from './frontend-revalidate.js';

afterEach(() => vi.unstubAllGlobals());

describe('frontend revalidate', () => {
  it('token is a stable hash of the shared secret, different per secret', () => {
    expect(revalidateToken('a')).toBe(revalidateToken('a'));
    expect(revalidateToken('a')).not.toBe(revalidateToken('b'));
    expect(revalidateToken('a')).toMatch(/^[0-9a-f]{64}$/);
    expect(revalidateToken('a')).not.toContain('a'.repeat(8));
  });

  it('posts to the frontend with the token header', async () => {
    const f = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', f);
    revalidatePublicPages();
    const [url, init] = f.mock.calls[0];
    expect(url).toMatch(/\/revalidate$/);
    expect(init.method).toBe('POST');
    expect(init.headers['x-revalidate-token']).toBe(revalidateToken());
  });

  it('never throws, even when the frontend is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down');
      })
    );
    expect(() => revalidatePublicPages()).not.toThrow();
    await new Promise((r) => setTimeout(r, 5));
  });
});
