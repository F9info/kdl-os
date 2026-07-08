import { prisma } from '../../config/database.js';
import { getModuleStatus } from '../../middleware/module-gate.js';
import { integrationsQueue } from './integrations.queue.js';

export class IntegrationsDisabledError extends Error {
  constructor() {
    super('Integrations module is disabled');
    this.name = 'IntegrationsDisabledError';
    this.status = 503;
  }
}

export function scrubPii(text) {
  if (!text) return text;
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email]')
    .replace(/\+?[\d][\d\s\-().]{7,}[\d]/g, '[phone]')
    .replace(/(password|passwd|pwd|token|secret|otp|code)[=:\s]+\S+/gi, '$1=[redacted]');
}

export function maskRecipient(value) {
  const s = String(value).trim();
  if (s.includes('@')) {
    const atIdx = s.indexOf('@');
    const local = s.slice(0, atIdx);
    const domain = s.slice(atIdx + 1);
    return `${local[0] ?? '*'}***@${domain}`;
  }
  const digits = s.replace(/\D/g, '');
  if (digits.length <= 5) return '*'.repeat(digits.length);
  return `${digits.slice(0, 2)}${'*'.repeat(5)}${digits.slice(-3)}`;
}

export async function dispatchMessage({ channel, to, subject, body, source, meta }) {
  const status = await getModuleStatus('integrations');
  if (status !== 'ENABLED') {
    throw new IntegrationsDisabledError();
  }

  const log = await prisma.integrationLog.create({
    data: {
      channel,
      recipient: maskRecipient(to),
      subject: subject ?? null,
      body_preview: body ? scrubPii(body).slice(0, 120) : null,
      status: 'QUEUED',
      source,
    },
  });

  await integrationsQueue.add('send', {
    logId: log.id,
    channel,
    to,
    subject: subject ?? null,
    body,
    source,
    meta: meta ?? null,
  });

  return { logId: log.id };
}
