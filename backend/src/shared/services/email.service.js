import nodemailer from 'nodemailer';
import { getModuleStatus } from '../../middleware/module-gate.js';

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const smtpSend = (to, subject, html) =>
  transport.sendMail({ from: process.env.SMTP_FROM, to, subject, html });

export const sendEmail = async (to, subject, html) => {
  try {
    const status = await getModuleStatus('integrations');
    if (status === 'ENABLED') {
      const { dispatchMessage } = await import('../../modules/integrations/service.js');
      return await dispatchMessage({ channel: 'EMAIL', source: 'core', to, subject, body: html });
    }
  } catch {
    // integrations module absent or unavailable — fall through to direct SMTP
  }
  return smtpSend(to, subject, html);
};
