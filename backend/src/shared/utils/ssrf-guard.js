import { promises as dns } from 'node:dns';
import net from 'node:net';

// IPv4 ranges that must never be contacted by cloud-import drivers (SSRF protection).
// Covers: loopback, RFC1918, link-local (incl. AWS IMDS 169.254.169.254), CGNAT,
// multicast, reserved, and IETF special-purpose blocks.
const BLOCKED_IPV4_CIDRS = [
  [0x7f000000, 8],   // 127.0.0.0/8  loopback
  [0x0a000000, 8],   // 10.0.0.0/8   RFC1918
  [0xac100000, 12],  // 172.16.0.0/12 RFC1918
  [0xc0a80000, 16],  // 192.168.0.0/16 RFC1918
  [0xa9fe0000, 16],  // 169.254.0.0/16 link-local / AWS IMDS
  [0x64400000, 10],  // 100.64.0.0/10 CGNAT RFC6598
  [0xe0000000, 4],   // 224.0.0.0/4  multicast
  [0xf0000000, 4],   // 240.0.0.0/4  reserved
  [0x00000000, 8],   // 0.0.0.0/8    "this" network
  [0xc0000000, 24],  // 192.0.0.0/24 IETF protocol assignments
  [0xc0000200, 24],  // 192.0.2.0/24 TEST-NET-1
  [0xc6336400, 24],  // 198.51.100.0/24 TEST-NET-2
  [0xcb007100, 24],  // 203.0.113.0/24 TEST-NET-3
];

const ipv4ToInt = (ip) =>
  ip.split('.').reduce((acc, octet) => (acc * 256 + Number(octet)) >>> 0, 0);

const isBlockedIPv4 = (ip) => {
  if (!net.isIPv4(ip)) return false;
  const n = ipv4ToInt(ip);
  return BLOCKED_IPV4_CIDRS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (base & mask);
  });
};

const isBlockedIPv6 = (ip) => {
  if (!net.isIPv6(ip)) return false;
  const lo = ip.toLowerCase();
  if (lo === '::1') return true;                           // loopback
  if (/^fe[89ab]/i.test(lo)) return true;                 // fe80::/10 link-local
  if (/^f[cd]/i.test(lo)) return true;                    // fc00::/7  ULA
  // IPv4-mapped ::ffff:a.b.c.d
  const m = lo.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (m && isBlockedIPv4(m[1])) return true;
  return false;
};

/**
 * Resolve host to all IPs and throw if any resolves to a blocked range.
 * Call this before opening any network connection to a user-supplied host.
 *
 * @param {string} host  Hostname or IP address
 * @throws {Error}  If the host resolves to a private/reserved/internal address
 */
export const assertNotSSRF = async (host) => {
  if (!host || typeof host !== 'string') {
    throw new Error('SSRF guard: host must be a non-empty string');
  }

  const stripped = host.replace(/^\[/, '').replace(/\]$/, ''); // strip IPv6 brackets

  // If already a numeric IP, check directly without DNS.
  if (net.isIP(stripped)) {
    if (isBlockedIPv4(stripped) || isBlockedIPv6(stripped)) {
      throw new Error(`SSRF guard: blocked IP address "${stripped}"`);
    }
    return;
  }

  // DNS-resolve and check every returned address.
  let records;
  try {
    records = await dns.lookup(stripped, { all: true });
  } catch (err) {
    throw new Error(`SSRF guard: failed to resolve host "${stripped}": ${err.message}`);
  }

  if (!records.length) {
    throw new Error(`SSRF guard: no addresses resolved for host "${stripped}"`);
  }

  for (const { address } of records) {
    if (isBlockedIPv4(address) || isBlockedIPv6(address)) {
      throw new Error(`SSRF guard: host "${stripped}" resolves to blocked address "${address}"`);
    }
  }
};
