import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { dnsLookupMock } = vi.hoisted(() => ({
  dnsLookupMock: vi.fn(),
}));

vi.mock('node:dns/promises', () => ({ lookup: dnsLookupMock }));

import { assertPublicHost, assertPublicEndpoint, isPrivateV4, isPrivateV6 } from '../../src/shared/utils/ssrf-guard.js';

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SSRF_ALLOWLIST;
});
afterEach(() => {
  delete process.env.SSRF_ALLOWLIST;
});

// ─── isPrivateV4 unit tests ───────────────────────────────────────────────────

describe('isPrivateV4', () => {
  it.each([
    ['127.0.0.1', true],
    ['127.255.255.255', true],
    ['10.0.0.1', true],
    ['10.255.255.255', true],
    ['172.16.0.1', true],
    ['172.31.255.255', true],
    ['192.168.0.1', true],
    ['192.168.255.255', true],
    ['169.254.169.254', true],  // cloud metadata endpoint
    ['169.254.0.1', true],
    ['100.64.0.1', true],       // CGNAT
    ['0.0.0.1', true],
    ['224.0.0.1', true],        // multicast
    ['240.0.0.1', true],        // reserved
    ['8.8.8.8', false],
    ['1.1.1.1', false],
    ['172.15.255.255', false],  // just outside 172.16/12
    ['172.32.0.0', false],      // just outside 172.16/12
    ['192.167.255.255', false],
    ['11.0.0.1', false],
  ])('%s → %s', (addr, expected) => {
    expect(isPrivateV4(addr)).toBe(expected);
  });
});

// ─── isPrivateV6 unit tests ───────────────────────────────────────────────────

describe('isPrivateV6', () => {
  it.each([
    ['::1', true],                          // loopback
    ['::', true],                           // unspecified
    ['fc00::1', true],                      // ULA
    ['fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', true], // ULA max
    ['fe80::1', true],                      // link-local
    ['febf::1', true],                      // link-local max
    ['ff02::1', true],                      // multicast
    ['::ffff:192.168.1.1', true],           // IPv4-mapped private
    ['::ffff:169.254.169.254', true],       // IPv4-mapped cloud metadata
    ['::ffff:10.0.0.1', true],              // IPv4-mapped RFC1918
    ['2001:db8::1', false],                 // documentation (not blocked)
    ['2606:4700::1', false],                // Cloudflare public DNS
    ['::ffff:8.8.8.8', false],              // IPv4-mapped public
    ['fec0::1', false],                     // outside fe80::/10 (old site-local, deprecated but not in our list)
  ])('%s → %s', (addr, expected) => {
    expect(isPrivateV6(addr)).toBe(expected);
  });
});

// ─── assertPublicHost ─────────────────────────────────────────────────────────

describe('assertPublicHost — literal IPs, no DNS', () => {
  it('rejects loopback IPv4 without DNS lookup', async () => {
    await expect(assertPublicHost('127.0.0.1')).rejects.toMatchObject({ status: 400 });
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });

  it('rejects 169.254.169.254 (cloud metadata) without DNS', async () => {
    await expect(assertPublicHost('169.254.169.254')).rejects.toMatchObject({ status: 400 });
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });

  it('rejects RFC1918 IPv4 without DNS', async () => {
    await expect(assertPublicHost('192.168.1.1')).rejects.toMatchObject({ status: 400 });
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });

  it('rejects ::1 IPv6 loopback without DNS', async () => {
    await expect(assertPublicHost('::1')).rejects.toMatchObject({ status: 400 });
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });

  it('rejects fe80:: link-local IPv6 without DNS', async () => {
    await expect(assertPublicHost('fe80::1')).rejects.toMatchObject({ status: 400 });
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });

  it('rejects fc00:: ULA IPv6 without DNS', async () => {
    await expect(assertPublicHost('fc00::dead:beef')).rejects.toMatchObject({ status: 400 });
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });

  it('accepts a public IPv4 literal without DNS', async () => {
    await expect(assertPublicHost('8.8.8.8')).resolves.toBeUndefined();
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });

  it('accepts a public IPv6 literal without DNS', async () => {
    await expect(assertPublicHost('2606:4700::1111')).resolves.toBeUndefined();
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });

  it('accepts bracket-wrapped IPv6 literal without DNS', async () => {
    await expect(assertPublicHost('[2606:4700::1111]')).resolves.toBeUndefined();
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });

  it('rejects bracket-wrapped private IPv6 without DNS', async () => {
    await expect(assertPublicHost('[::1]')).rejects.toMatchObject({ status: 400 });
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });
});

describe('assertPublicHost — hostname DNS resolution', () => {
  it('resolves hostname and accepts when all IPs are public', async () => {
    dnsLookupMock.mockResolvedValue([
      { address: '104.21.0.1', family: 4 },
      { address: '2606:4700::6815:1', family: 6 },
    ]);
    await expect(assertPublicHost('example.com')).resolves.toBeUndefined();
    expect(dnsLookupMock).toHaveBeenCalledWith('example.com', { all: true });
  });

  it('rejects when any resolved IP is private (even if others are public)', async () => {
    dnsLookupMock.mockResolvedValue([
      { address: '104.21.0.1', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]);
    await expect(assertPublicHost('evil.example.com')).rejects.toMatchObject({ status: 400 });
  });

  it('rejects when resolved IP is 169.254.169.254 (cloud metadata SSRF)', async () => {
    dnsLookupMock.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    await expect(assertPublicHost('metadata.internal')).rejects.toMatchObject({ status: 400 });
  });

  it('rejects when DNS resolution fails', async () => {
    dnsLookupMock.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(assertPublicHost('notreal.example')).rejects.toMatchObject({ status: 400 });
  });

  it('rejects when DNS returns no addresses', async () => {
    dnsLookupMock.mockResolvedValue([]);
    await expect(assertPublicHost('empty.example')).rejects.toMatchObject({ status: 400 });
  });

  it('rejects when hostname resolves to ::1 via IPv6', async () => {
    dnsLookupMock.mockResolvedValue([{ address: '::1', family: 6 }]);
    await expect(assertPublicHost('localhost')).rejects.toMatchObject({ status: 400 });
  });
});

describe('assertPublicHost — allowlist', () => {
  it('bypasses private-IP check for an allowlisted hostname', async () => {
    process.env.SSRF_ALLOWLIST = 'minio.internal,other.host';
    dnsLookupMock.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
    await expect(assertPublicHost('minio.internal')).resolves.toBeUndefined();
  });

  it('allowlist is case-insensitive', async () => {
    process.env.SSRF_ALLOWLIST = 'MinIO.Internal';
    await expect(assertPublicHost('minio.internal')).resolves.toBeUndefined();
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });

  it('does not allowlist a host not in the list', async () => {
    process.env.SSRF_ALLOWLIST = 'other.host';
    dnsLookupMock.mockResolvedValue([{ address: '192.168.1.1', family: 4 }]);
    await expect(assertPublicHost('minio.internal')).rejects.toMatchObject({ status: 400 });
  });
});

// ─── assertPublicEndpoint ─────────────────────────────────────────────────────

describe('assertPublicEndpoint', () => {
  it('accepts a valid public https endpoint', async () => {
    dnsLookupMock.mockResolvedValue([{ address: '52.94.0.1', family: 4 }]);
    await expect(assertPublicEndpoint('https://s3.amazonaws.com')).resolves.toBeUndefined();
  });

  it('accepts http endpoints (for dev/self-hosted with public IPs)', async () => {
    dnsLookupMock.mockResolvedValue([{ address: '52.94.0.1', family: 4 }]);
    await expect(assertPublicEndpoint('http://s3.example.com')).resolves.toBeUndefined();
  });

  it('rejects ftp:// scheme', async () => {
    await expect(assertPublicEndpoint('ftp://s3.example.com/bucket')).rejects.toMatchObject({ status: 400 });
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });

  it('rejects file:// scheme', async () => {
    await expect(assertPublicEndpoint('file:///etc/passwd')).rejects.toMatchObject({ status: 400 });
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid URL string', async () => {
    await expect(assertPublicEndpoint('not-a-url')).rejects.toMatchObject({ status: 400 });
  });

  it('rejects https endpoint that resolves to a private IP', async () => {
    dnsLookupMock.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    await expect(assertPublicEndpoint('https://metadata.internal')).rejects.toMatchObject({ status: 400 });
  });

  it('rejects endpoint whose host is a private IP literal', async () => {
    await expect(assertPublicEndpoint('https://192.168.1.50')).rejects.toMatchObject({ status: 400 });
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });

  it('rejects http://127.0.0.1 (loopback)', async () => {
    await expect(assertPublicEndpoint('http://127.0.0.1')).rejects.toMatchObject({ status: 400 });
  });

  it('accepts https://minio.internal when allowlisted', async () => {
    process.env.SSRF_ALLOWLIST = 'minio.internal';
    await expect(assertPublicEndpoint('https://minio.internal')).resolves.toBeUndefined();
    expect(dnsLookupMock).not.toHaveBeenCalled();
  });
});
