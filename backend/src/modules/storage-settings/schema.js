import { z } from 'zod';

const PROVIDERS = ['local', 'minio', 's3', 'spaces', 'r2'];

// RFC1918 / loopback / link-local patterns — block these to prevent SSRF.
const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|::1$|fc00:|fe80:)/i;

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
