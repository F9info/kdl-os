import nodemailer from 'nodemailer';
import { z } from 'zod';

const credentialsSchema = z.object({
  host: z.string().min(1),
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
