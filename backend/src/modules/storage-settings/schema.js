import { z } from 'zod';

const PROVIDERS = ['local', 'minio', 's3', 'spaces', 'r2'];

// RFC1918 / loopback / link-local / ULA / multicast patterns (static pre-flight).
// The service layer adds an async DNS-resolve check via assertPublicEndpoint.
const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe[89ab][0-9a-f]:|ff[0-9a-f]{2}:)/i;

const safeEndpoint = z
  .string()
  .url({ message: 'endpoint must be a valid URL' })
  .refine((url) => {
    let parsed;
    try { parsed = new URL(url); } catch { return false; }
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') return false;
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname;
    if (host === 'localhost') return false;
    if (PRIVATE_IP_RE.test(host)) return false;
    if (host === '0.0.0.0' || host === '::' || host === '[::]') return false;
    if (/^::ffff:/i.test(host)) return false;
    // Reject integer-encoded (2130706433), hex-encoded (0x7f000001), octal-octet (0177.0.0.1) IPs
    if (/^\d+$/.test(host)) return false;
    if (/^0x[0-9a-f]+$/i.test(host)) return false;
    if (/(?:^|\.)0\d/.test(host)) return false;
    return true;
  }, {
    message: process.env.NODE_ENV === 'production'
      ? 'endpoint must use HTTPS and point to a public host'
      : 'endpoint must use HTTP/HTTPS and not point to a loopback or private address',
  })
  .nullable()
  .optional();

const settingsBody = z.object({
  provider: z.enum(PROVIDERS).optional(),
  endpoint: safeEndpoint,
  region: z.string().nullable().optional(),
  bucket: z.string().nullable().optional(),
  accessKey: z.string().nullable().optional(),
  secretKey: z.string().nullable().optional(),
});

export const updateStorageSettingsSchema = z.object({ body: settingsBody });
export const testStorageConnectionSchema = z.object({ body: settingsBody.optional().default({}) });
