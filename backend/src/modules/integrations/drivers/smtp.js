import nodemailer from 'nodemailer';
import { z } from 'zod';

// RFC1918 / loopback / link-local static pre-flight — mirrors storage-settings safeEndpoint.
// Async DNS check happens in the integrations controller via assertPublicHost.
const PRIVATE_HOST_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe[89ab][0-9a-f]:|ff[0-9a-f]{2}:)/i;

function isUnsafeHost(host) {
  if (!host) return true;
  if (host === 'localhost' || host === '0.0.0.0' || host === '::' || host === '[::1]') return true;
  if (PRIVATE_HOST_RE.test(host)) return true;
  if (/^::ffff:/i.test(host)) return true;
  if (/^\d+$/.test(host)) return true;
  if (/^0x[0-9a-f]+$/i.test(host)) return true;
  if (/(?:^|\.)0\d/.test(host)) return true;
  return false;
}

const credentialsSchema = z.object({
  host: z.string().min(1).refine((h) => !isUnsafeHost(h), {
    message: 'SMTP host must not point to a loopback, private, or reserved address',
  }),
  port: z.coerce.number().int().min(1).max(65535),
  user: z.string().min(1),
  pass: z.string().min(1),
});

const configSchema = z.object({
  from: z.string().email(),
});

export default {
  channel: 'EMAIL',
  driver: 'smtp',
  credentialsSchema,
  configSchema,

  async send({ credentials, config, to, subject, body }) {
    const transporter = nodemailer.createTransport({
      host: credentials.host,
      port: Number(credentials.port),
      secure: Number(credentials.port) === 465,
      auth: { user: credentials.user, pass: credentials.pass },
    });
    const info = await transporter.sendMail({
      from: config.from,
      to,
      subject: subject ?? '(no subject)',
      html: body,
    });
    return { provider_ref: info.messageId };
  },

  verifySignature() {
    return false;
  },

  parseWebhook(_req) {
    return null;
  },
};
