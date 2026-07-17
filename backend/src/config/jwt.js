// Fail-fast JWT secret validation — mirrors shared/utils/crypto.js loadKey() pattern.
// Both secrets are validated at module load so the server refuses to boot with bad config.

const PLACEHOLDER_PATTERNS = ['change_this', 'changeme', 'replace_me', 'your_key'];

function validateJwtSecret(name, value) {
  if (!value) throw new Error(`${name} env var is required — set a cryptographically random secret`);
  if (Buffer.byteLength(value, 'utf8') < 32) {
    throw new Error(`${name} must be at least 32 bytes (got ${Buffer.byteLength(value, 'utf8')})`);
  }
  const lower = value.toLowerCase();
  if (PLACEHOLDER_PATTERNS.some((p) => lower.includes(p))) {
    throw new Error(`${name} appears to be a placeholder — replace with a real secret`);
  }
}

function parseDurationMs(str) {
  const m = String(str).match(/^(\d+)(ms|s|m|h|d)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n * { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]];
}

validateJwtSecret('JWT_SECRET', process.env.JWT_SECRET);
validateJwtSecret('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET);

if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different secrets');
}

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
export const JWT_ISSUER = process.env.JWT_ISSUER || 'kdl-os';
export const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'kdl-os-api';
export const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '15m';
export const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
export const REFRESH_TOKEN_EXPIRY_MS =
  parseDurationMs(REFRESH_TOKEN_EXPIRY) ?? 7 * 24 * 60 * 60 * 1000;
