import { lookup } from 'node:dns/promises';
import { isIPv4 } from 'node:net';

// [network_uint32, mask_uint32] — all values unsigned 32-bit
const PRIVATE_V4_RANGES = [
  [0x7f000000, 0xff000000], // 127.0.0.0/8   loopback
  [0x0a000000, 0xff000000], // 10.0.0.0/8    RFC1918
  [0xac100000, 0xfff00000], // 172.16.0.0/12 RFC1918
  [0xc0a80000, 0xffff0000], // 192.168.0.0/16 RFC1918
  [0xa9fe0000, 0xffff0000], // 169.254.0.0/16 link-local / cloud metadata
  [0x64400000, 0xffc00000], // 100.64.0.0/10 CGNAT
  [0x00000000, 0xff000000], // 0.0.0.0/8     this-network
  [0xe0000000, 0xf0000000], // 224.0.0.0/4   multicast
  [0xf0000000, 0xf0000000], // 240.0.0.0/4   reserved
];

function isPrivateV4(addr) {
  const parts = addr.split('.');
  if (parts.length !== 4) return false;
  let n = 0;
  for (const p of parts) {
    const b = Number(p);
    if (!Number.isInteger(b) || b < 0 || b > 255) return false;
    n = ((n << 8) | b) >>> 0;
  }
  // `&` returns signed Int32; `>>> 0` converts back to unsigned for comparison.
  return PRIVATE_V4_RANGES.some(([net, mask]) => ((n & mask) >>> 0) === net);
}

// Expand any IPv6 address to a 32-char lowercase hex string (no colons, no zone id)
function expandIPv6(addr) {
  addr = addr.toLowerCase().replace(/%[^%]*$/, ''); // strip zone ID
  // IPv4-mapped: ::ffff:a.b.c.d
  const v4m = addr.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4m) {
    const parts = v4m[1].split('.');
    const n = parts.reduce((acc, p) => ((acc << 8) | Number(p)) >>> 0, 0);
    return '00000000000000000000ffff' + n.toString(16).padStart(8, '0');
  }
  const halves = addr.split('::');
  let groups;
  if (halves.length === 2) {
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const fill = 8 - left.length - right.length;
    groups = [...left, ...new Array(fill).fill('0'), ...right];
  } else {
    groups = addr.split(':');
  }
  return groups.map((g) => g.padStart(4, '0')).join('');
}

function isPrivateV6(addr) {
  const hex = expandIPv6(addr);
  const ip = BigInt('0x' + hex);

  if (ip === 0n) return true;                    // ::/128 unspecified
  if (ip === 1n) return true;                    // ::1/128 loopback
  if ((ip >> 121n) === 0x7en) return true;       // fc00::/7 ULA
  if ((ip >> 118n) === 0x3fan) return true;      // fe80::/10 link-local
  if ((ip >> 120n) === 0xffn) return true;       // ff00::/8 multicast

  // ::ffff:0:0/96 IPv4-mapped — check the embedded IPv4
  if ((ip >> 32n) === 0xffffn) {
    const v4int = Number(ip & 0xffffffffn) >>> 0;
    const v4 = [
      (v4int >>> 24) & 0xff,
      (v4int >>> 16) & 0xff,
      (v4int >>> 8) & 0xff,
      v4int & 0xff,
    ].join('.');
    return isPrivateV4(v4);
  }

  return false;
}

const ssrfError = (host) =>
  Object.assign(
    new Error(`SSRF guard: "${host}" resolves to a private or reserved address — not allowed`),
    { status: 400 },
  );

function getAllowlist() {
  return (process.env.SSRF_ALLOWLIST || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Resolve `host` to all its IPs and reject if any lands in a private/reserved
 * range. Pass literal IPs through without a DNS round-trip.
 *
 * Throws with status 400 on rejection.
 */
export async function assertPublicHost(host) {
  if (!host) throw Object.assign(new Error('SSRF guard: host is required'), { status: 400 });

  const stripped = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

  if (getAllowlist().includes(stripped.toLowerCase())) return;

  // Literal IPv4
  if (isIPv4(stripped)) {
    if (isPrivateV4(stripped)) throw ssrfError(stripped);
    return;
  }

  // Literal IPv6 (bracket form or raw)
  if (stripped.includes(':')) {
    if (isPrivateV6(stripped)) throw ssrfError(stripped);
    return;
  }

  // Hostname — resolve all addresses and check each
  let results;
  try {
    results = await lookup(stripped, { all: true });
  } catch {
    throw Object.assign(
      new Error(`SSRF guard: could not resolve host "${stripped}"`),
      { status: 400 },
    );
  }

  if (!results.length) {
    throw Object.assign(new Error(`SSRF guard: host "${stripped}" returned no addresses`), { status: 400 });
  }

  for (const { address, family } of results) {
    const blocked = family === 6 ? isPrivateV6(address) : isPrivateV4(address);
    if (blocked) throw ssrfError(stripped);
  }
}

/**
 * Validate `endpoint` as an https/http URL whose host passes `assertPublicHost`.
 * Non-https/http schemes are rejected outright.
 *
 * Throws with status 400 on rejection.
 */
export async function assertPublicEndpoint(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw Object.assign(new Error('SSRF guard: invalid endpoint URL'), { status: 400 });
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw Object.assign(
      new Error(`SSRF guard: endpoint scheme "${url.protocol}" is not allowed — use https`),
      { status: 400 },
    );
  }
  await assertPublicHost(url.hostname);
}

export { isPrivateV4, isPrivateV6 };
