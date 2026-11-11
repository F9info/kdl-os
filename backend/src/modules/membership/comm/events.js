// The 44 membership events and their English default copy (source: static-kdl-os/membership, adm-comm-*.html,
// web-email-*, m10, m21-email-*). Seeded once; admins edit everything afterwards from Communication > Templates.
// Pure data + string building, no database.

export const GROUPS = {
  A: 'Registration & onboarding',
  B: 'Payment & transaction',
  C: 'Renewal',
  D: 'Cancellation',
  E: 'Account & security',
  F: 'From our membership flows',
};

export const CHANNELS = ['IN_APP', 'WHATSAPP', 'EMAIL', 'SMS'];
export const LANGS = ['en', 'te', 'hi'];

/** Every variable a template may use. Admins see this list in the editor. */
export const VARIABLES = [
  ['member_name', 'Member full name'], ['member_email', 'Member email'], ['member_phone', 'Member mobile'],
  ['membership_name', 'Plan name'], ['membership_plan', 'Plan and billing interval, e.g. Gold · Yearly'], ['membership_id', 'Member number'],
  ['membership_status', 'Subscription status'], ['start_date', 'Period start'], ['expiry_date', 'Period end'], ['renewal_date', 'Next renewal date'],
  ['amount', 'Amount with currency symbol'], ['currency', 'Currency code'], ['transaction_id', 'Payment reference or gateway id'],
  ['payment_status', 'Payment status'], ['payment_date', 'Payment date'], ['invoice_url', 'Invoice link'], ['cancellation_date', 'Cancellation date'],
  ['support_email', 'Support email'], ['company_name', 'Organisation name'], ['company_logo', 'Logo URL'], ['website_url', 'Website URL'],
  ['days_left', 'When it ends, e.g. in 7 days (reminders)'], ['reason', 'Reason given'], ['refund_amount', 'Refund amount'], ['invoice_number', 'Invoice number'],
  ['old_plan', 'Previous plan'], ['new_plan', 'New plan'], ['utr', 'Bank UTR'], ['login_time', 'Login time'], ['device', 'Device or browser'],
  ['document_name', 'Document'], ['contact_name', 'Invited contact'], ['changed_fields', 'What was changed'], ['reset_link', 'Password reset link'],
].map(([key, description]) => ({ key, description }));

const T = 'transactional';
const P = 'payment';
const S = 'security';
const A = '/membership/account';

// [key, group, name, category, mandatory, inapp title, inapp body, url, whatsapp, email subject, email lines, button [label, var]|null]
const E = [
  // A
  ['account.created', 'A', 'Account created', T, 0, 'Welcome to {{company_name}}', 'Your account is ready, {{member_name}}.', A, 'Hello {{member_name}}, your {{company_name}} account has been created. Welcome aboard!', 'Welcome to {{company_name}}, {{member_name}}', ['Your account has been created with {{member_email}}.', 'Choose a plan any time to become a member.'], ['Open my account', 'website_url']],
  ['membership.purchased', 'A', 'Membership purchased', T, 0, 'Membership purchased', 'You chose {{membership_plan}}. Complete payment to activate it.', A, 'Hello {{member_name}}, thank you for choosing {{membership_plan}}. We will confirm once it is active.', 'Thank you for choosing {{membership_plan}}', ['We have received your request for {{membership_plan}}.', 'Your membership starts as soon as the payment (and approval, if needed) is complete.'], null],
  ['membership.activated', 'A', 'Membership activated', T, 0, 'Welcome to {{membership_name}}', 'Your member card is ready. Valid until {{expiry_date}}.', A + '/card', 'Hello {{member_name}}, your {{membership_plan}} membership is active until {{expiry_date}}. Welcome!', 'Welcome to {{membership_name}}, {{member_name}}!', ['Your membership is now active.', 'Member number: {{membership_id}}', 'Valid: {{start_date}} – {{expiry_date}}'], ['View my member card', 'website_url']],
  ['membership.onboarding_completed', 'A', 'Onboarding completed', T, 0, 'Profile complete', 'Thanks for completing your profile, {{member_name}}.', A + '/profile', 'Hello {{member_name}}, your membership profile is complete. Thank you!', 'Your membership profile is complete', ['Thanks for completing your profile.', 'You can update it any time from your account.'], null],
  ['membership.updated', 'A', 'Membership details updated', T, 0, 'Profile updated', 'Your details were updated: {{changed_fields}}.', A + '/profile', 'Hello {{member_name}}, your membership details were updated ({{changed_fields}}). If this was not you, write to {{support_email}}.', 'Your membership details were updated', ['The following was changed: {{changed_fields}}.', 'Not you? Write to {{support_email}} right away.'], null],
  ['membership.benefits_activated', 'A', 'Benefits / access activated', T, 0, 'Member benefits unlocked', 'Your {{membership_name}} benefits and members-only content are now available.', A + '/library', 'Hello {{member_name}}, your {{membership_name}} benefits are now unlocked. Enjoy!', 'Your {{membership_name}} benefits are unlocked', ['Members-only pages and benefits for {{membership_name}} are now available to you.'], ['Open members-only content', 'website_url']],
  // B
  ['payment.succeeded', 'B', 'Payment successful', P, 1, 'Payment successful', 'Your membership payment of {{amount}} was successful. Your membership is now active until {{expiry_date}}.', A + '/payments', 'Hello {{member_name}}, your membership payment of {{amount}} has been received successfully. Your {{membership_plan}} membership is active until {{expiry_date}}. Thank you!', 'Your membership payment is successful, {{member_name}}!', ['We have received your payment of {{amount}} for {{membership_plan}}.', 'Transaction ID: {{transaction_id}}', 'Paid on: {{payment_date}}', 'Membership: {{start_date}} – {{expiry_date}}'], ['Download invoice', 'invoice_url']],
  ['payment.failed', 'B', 'Payment failed', P, 1, 'Payment failed', 'Your payment of {{amount}} could not be completed. Please try again.', A + '/plan', 'Hello {{member_name}}, your payment of {{amount}} for {{membership_plan}} did not go through. Please try again: {{website_url}}', 'Your membership payment did not go through', ['Your payment of {{amount}} for {{membership_plan}} could not be completed.', 'Reason: {{reason}}', 'No money has been kept. You can try again in one click.'], ['Try again', 'website_url']],
  ['payment.pending', 'B', 'Payment pending', P, 1, 'Payment pending', 'We are waiting for your payment of {{amount}}.', A + '/payments', 'Hello {{member_name}}, your payment of {{amount}} is pending. We will update you as soon as it is confirmed.', 'Your payment of {{amount}} is pending', ['We are waiting for confirmation of your payment of {{amount}} (reference {{transaction_id}}).'], null],
  ['payment.refunded', 'B', 'Payment refunded', P, 1, 'Refund processed', '{{refund_amount}} has been refunded for {{transaction_id}}.', A + '/payments', 'Hello {{member_name}}, we have refunded {{refund_amount}} for payment {{transaction_id}}. It reaches your account in 5-7 working days.', 'Your refund of {{refund_amount}} is on its way', ['We have refunded {{refund_amount}} for payment {{transaction_id}}.', 'It usually reaches your account within 5-7 working days.'], null],
  ['payment.partially_refunded', 'B', 'Payment partially refunded', P, 1, 'Partial refund processed', '{{refund_amount}} of {{amount}} was refunded for {{transaction_id}}.', A + '/payments', 'Hello {{member_name}}, we have refunded {{refund_amount}} of your payment {{transaction_id}}.', 'A partial refund of {{refund_amount}} was issued', ['We have refunded {{refund_amount}} of your payment of {{amount}} (reference {{transaction_id}}).'], null],
  ['payment.cancelled', 'B', 'Payment cancelled', P, 1, 'Payment cancelled', 'Your payment {{transaction_id}} was cancelled.', A + '/payments', 'Hello {{member_name}}, your payment {{transaction_id}} was cancelled. No money was charged.', 'Your payment was cancelled', ['Payment {{transaction_id}} for {{membership_plan}} was cancelled. No money was charged.'], null],
  ['invoice.generated', 'B', 'Invoice / receipt generated', P, 1, 'Invoice {{invoice_number}} is ready', 'Your GST invoice is ready to download.', A + '/invoices', 'Hello {{member_name}}, your GST invoice {{invoice_number}} is ready: {{invoice_url}}', 'Your GST invoice {{invoice_number}}', ['Your GST invoice {{invoice_number}} for {{amount}} is ready.'], ['Download invoice', 'invoice_url']],
  // C
  ['renewal.reminder', 'C', 'Renewal reminder (scheduled)', P, 1, 'Your membership ends {{days_left}}', '{{membership_plan}} ends on {{expiry_date}}. Renew to keep your benefits.', A + '/plan', 'Hello {{member_name}}, your {{membership_name}} membership ends {{days_left}} ({{expiry_date}}). Renew in one click: {{website_url}}', 'Your membership ends {{days_left}}', ['Your {{membership_plan}} membership ends on {{expiry_date}}.', 'Renew now to keep your benefits without a break.'], ['Renew now', 'website_url']],
  ['renewal.succeeded', 'C', 'Renewal successful', P, 1, 'Membership renewed', 'Thank you! Your membership is renewed until {{expiry_date}}.', A, 'Hello {{member_name}}, your {{membership_plan}} membership has been renewed until {{expiry_date}}. Thank you!', 'Your membership is renewed', ['Thank you, {{member_name}}. Your {{membership_plan}} membership is renewed until {{expiry_date}}.', 'Paid: {{amount}} · {{transaction_id}}'], ['Download invoice', 'invoice_url']],
  ['renewal.failed', 'C', 'Renewal payment failed', P, 1, 'Renewal payment failed', 'We could not renew your membership. Please pay {{amount}} to keep it.', A + '/plan', 'Hello {{member_name}}, we could not process your renewal of {{amount}}. Please try again: {{website_url}}', 'We could not renew your membership', ['Your renewal payment of {{amount}} did not go through.', 'Your membership stays open until {{expiry_date}} plus the grace period.'], ['Pay now', 'website_url']],
  ['renewal.pending', 'C', 'Renewal pending', P, 1, 'Renewal pending', 'Your renewal payment is awaiting confirmation.', A + '/payments', 'Hello {{member_name}}, your renewal payment of {{amount}} is awaiting confirmation.', 'Your renewal is pending', ['We are waiting for confirmation of your renewal payment of {{amount}}.'], null],
  ['membership.extended', 'C', 'Membership extended', T, 0, 'Membership extended', 'Your membership now runs until {{expiry_date}}.', A, 'Hello {{member_name}}, your {{membership_plan}} membership has been extended until {{expiry_date}}.', 'Your membership was extended', ['Good news: your {{membership_plan}} membership now runs until {{expiry_date}}.'], null],
  ['membership.expired', 'C', 'Membership expired', P, 1, 'Membership expired', 'Your {{membership_plan}} membership expired on {{expiry_date}}. Renew to get access back.', A + '/plan', 'Hello {{member_name}}, your {{membership_plan}} membership expired on {{expiry_date}}. Renew any time: {{website_url}}', 'Your membership has expired', ['Your {{membership_plan}} membership expired on {{expiry_date}}.', 'Your member number {{membership_id}} stays on record: renew any time and pick up where you left off.'], ['Renew membership', 'website_url']],
  ['autorenew.enabled', 'C', 'Auto-renewal enabled', T, 0, 'Auto-renewal is on', 'Your membership will renew automatically on {{renewal_date}}.', A + '/plan', 'Hello {{member_name}}, auto-renewal is now on. Your next renewal is {{renewal_date}}.', 'Auto-renewal is on', ['Your membership will renew automatically on {{renewal_date}}. You can switch it off any time.'], null],
  ['autorenew.disabled', 'C', 'Auto-renewal disabled', T, 0, 'Auto-renewal is off', 'Your membership will not renew automatically after {{expiry_date}}.', A + '/plan', 'Hello {{member_name}}, auto-renewal is now off. Your membership ends on {{expiry_date}}.', 'Auto-renewal is off', ['Auto-renewal is switched off. Your membership ends on {{expiry_date}} unless you renew.'], null],
  ['autorenew.failed', 'C', 'Auto-renewal payment failed', P, 1, 'Auto-renewal failed', 'We could not charge {{amount}} for your renewal.', A + '/plan', 'Hello {{member_name}}, the automatic renewal of {{amount}} failed. Please pay manually: {{website_url}}', 'Auto-renewal payment failed', ['We tried to renew {{membership_plan}} automatically but the payment of {{amount}} failed.', 'Please renew manually to avoid losing access.'], ['Renew now', 'website_url']],
  // D
  ['cancellation.requested', 'D', 'Cancellation requested', T, 0, 'Cancellation requested', 'We received your request to cancel {{membership_plan}}.', A + '/plan', 'Hello {{member_name}}, we received your request to cancel {{membership_plan}}. It stays active until {{expiry_date}}.', 'We received your cancellation request', ['You asked to cancel {{membership_plan}}.', 'It stays active until {{expiry_date}}. Changed your mind? You can undo this from your account.'], null],
  ['cancellation.confirmed', 'D', 'Cancellation confirmed', T, 0, 'Cancellation confirmed', 'Your membership will end on {{expiry_date}}.', A + '/plan', 'Hello {{member_name}}, your cancellation is confirmed. Your membership ends on {{expiry_date}}.', 'Your cancellation is confirmed', ['Your cancellation is confirmed. {{membership_plan}} ends on {{expiry_date}}.', 'Thank you for being with us, {{member_name}}.'], null],
  ['cancellation.rejected', 'D', 'Cancellation rejected', T, 0, 'Cancellation not approved', 'Your cancellation request was not approved: {{reason}}.', A + '/plan', 'Hello {{member_name}}, your cancellation request was not approved: {{reason}}. Write to {{support_email}} for help.', 'Your cancellation request was not approved', ['We could not approve your cancellation request.', 'Reason: {{reason}}'], null],
  ['cancellation.by_admin', 'D', 'Cancelled by admin', P, 1, 'Membership cancelled', 'Your membership was cancelled by {{company_name}}. {{reason}}', A, 'Hello {{member_name}}, your {{membership_plan}} membership was cancelled by {{company_name}}. Reason: {{reason}}. Questions? {{support_email}}', 'Your membership was cancelled', ['{{company_name}} has cancelled your {{membership_plan}} membership.', 'Reason: {{reason}}', 'Questions? Write to {{support_email}}.'], null],
  ['cancellation.effective', 'D', 'Cancellation takes effect', T, 0, 'Membership ended', 'Your membership ended on {{cancellation_date}}.', A, 'Hello {{member_name}}, your {{membership_plan}} membership ended on {{cancellation_date}}. We hope to see you again.', 'Your membership has ended', ['Your {{membership_plan}} membership ended on {{cancellation_date}}.', 'You are always welcome back.'], ['Rejoin', 'website_url']],
  ['access.revoked', 'D', 'Access revoked', P, 1, 'Member access ended', 'Members-only content is no longer available on your account.', A, 'Hello {{member_name}}, your members-only access has ended. Renew to restore it: {{website_url}}', 'Your members-only access has ended', ['Your access to members-only content ended because your membership is no longer active.'], ['Restore access', 'website_url']],
  ['membership.reactivated', 'D', 'Membership reactivated', T, 0, 'Membership reactivated', 'Welcome back! Your membership is active until {{expiry_date}}.', A, 'Hello {{member_name}}, welcome back! Your {{membership_plan}} membership is active again until {{expiry_date}}.', 'Welcome back, {{member_name}}', ['Your {{membership_plan}} membership is active again until {{expiry_date}}.'], null],
  ['membership.suspended', 'D', 'Membership suspended', P, 1, 'Membership suspended', 'Your membership was suspended. {{reason}}', A, 'Hello {{member_name}}, your {{membership_plan}} membership has been suspended. Reason: {{reason}}. Write to {{support_email}}.', 'Your membership is suspended', ['Your {{membership_plan}} membership has been suspended.', 'Reason: {{reason}}', 'Questions? Write to {{support_email}}.'], null],
  // E
  ['password.changed', 'E', 'Password changed', S, 1, 'Password changed', 'Your password was changed. Not you? Secure your account.', A + '/security', 'Hello {{member_name}}, your {{company_name}} password was changed. Not you? Write to {{support_email}} immediately.', 'Your password was changed', ['Your password was changed just now.', 'If this was not you, reset it immediately and write to {{support_email}}.'], ['Secure my account', 'website_url']],
  ['password.reset_requested', 'E', 'Password reset requested', S, 1, 'Password reset requested', 'We received a request to reset your password.', A + '/security', 'Hello {{member_name}}, we received a request to reset your password. If it was not you, ignore this message.', 'Reset your password', ['We received a request to reset your password.', 'If it was not you, you can ignore this email.'], ['Reset password', 'reset_link']],
  ['password.reset_completed', 'E', 'Password reset completed', S, 1, 'Password reset', 'Your password was reset successfully.', A + '/security', 'Hello {{member_name}}, your password was reset successfully. Not you? Write to {{support_email}}.', 'Your password was reset', ['Your password was reset successfully.', 'Not you? Write to {{support_email}} immediately.'], null],
  ['email.changed', 'E', 'Email address changed', S, 1, 'Email address changed', 'Your account email is now {{member_email}}.', A + '/security', 'Hello {{member_name}}, your account email was changed to {{member_email}}. Not you? Write to {{support_email}}.', 'Your email address was changed', ['Your account email was changed to {{member_email}}.', 'Not you? Write to {{support_email}} immediately.'], null],
  ['mobile.changed', 'E', 'Mobile number changed', S, 1, 'Mobile number changed', 'Your account mobile is now {{member_phone}}.', A + '/security', 'Hello {{member_name}}, your account mobile number was changed to {{member_phone}}. Not you? Write to {{support_email}}.', 'Your mobile number was changed', ['Your account mobile number was changed to {{member_phone}}.', 'Not you? Write to {{support_email}} immediately.'], null],
  ['security.new_login', 'E', 'New login / security alert', S, 1, 'New login from {{device}}', '{{login_time}}. Not you? Secure your account.', A + '/security', 'Hello {{member_name}}, a new login to your account was detected from {{device}} at {{login_time}}. Not you? {{support_email}}', 'New login to your account', ['We noticed a new login from {{device}} at {{login_time}}.', 'Not you? Secure your account now.'], ['Secure my account', 'website_url']],
  // F
  ['application.approved', 'F', 'Application approved', T, 0, 'Application approved', 'Welcome to {{membership_name}}! Valid until {{expiry_date}}.', A, 'Hello {{member_name}}, your {{membership_plan}} application is approved. Your membership is active until {{expiry_date}}.', 'Your application is approved', ['Great news, {{member_name}}: your {{membership_plan}} application is approved.', 'Member number: {{membership_id}} · valid until {{expiry_date}}'], ['View my membership', 'website_url']],
  ['application.rejected', 'F', 'Application not approved', T, 0, 'Application not approved', 'We could not approve your application. {{reason}}', A, 'Hello {{member_name}}, we could not approve your {{membership_plan}} application. Reason: {{reason}}. Questions? {{support_email}}', 'About your membership application', ['We were not able to approve your {{membership_plan}} application.', 'Reason: {{reason}}', 'Any payment is being refunded. Questions? Write to {{support_email}}.'], null],
  ['payment.offline_submitted', 'F', 'Bank transfer submitted', P, 1, 'Transfer details received', 'We are verifying your transfer of {{amount}} (UTR {{utr}}).', A + '/payments', 'Hello {{member_name}}, we received your transfer details (UTR {{utr}}) and are verifying them. We will confirm within one working day.', 'We received your transfer details', ['Thanks! We received your bank transfer details (UTR {{utr}}) for {{amount}}.', 'We verify transfers within one working day and will confirm by email.'], null],
  ['payment.offline_verified', 'F', 'Bank transfer verified', P, 1, 'Transfer verified', 'Your transfer of {{amount}} is verified.', A + '/payments', 'Hello {{member_name}}, your bank transfer of {{amount}} (UTR {{utr}}) is verified. Thank you!', 'Your bank transfer is verified', ['Your bank transfer of {{amount}} (UTR {{utr}}) has been verified.', 'Your membership: {{start_date}} – {{expiry_date}}'], ['Download invoice', 'invoice_url']],
  ['document.requested', 'F', 'Document requested', T, 0, 'Document needed', 'Please upload {{document_name}} to complete your membership.', A + '/profile', 'Hello {{member_name}}, please upload {{document_name}} to complete your membership: {{website_url}}', 'We need a document from you', ['To complete your membership please upload: {{document_name}}.'], ['Upload document', 'website_url']],
  ['document.verified', 'F', 'Document verified', T, 0, 'Document verified', '{{document_name}} was verified.', A + '/profile', 'Hello {{member_name}}, your document {{document_name}} was verified. Thank you!', 'Your document is verified', ['{{document_name}} has been verified.'], null],
  ['contact.invited', 'F', 'Contact invited', T, 0, 'Contact added', '{{contact_name}} was added to your organisation.', A + '/profile', 'Hello {{member_name}}, {{contact_name}} was added as a contact on your {{membership_plan}} membership.', '{{contact_name}} was added to your membership', ['{{contact_name}} was added as a contact on your organisation membership.'], null],
  ['plan.changed', 'F', 'Plan changed', T, 0, 'Plan changed', 'You are now on {{new_plan}}.', A + '/plan', 'Hello {{member_name}}, your plan changed from {{old_plan}} to {{new_plan}}.', 'Your plan changed to {{new_plan}}', ['Your plan changed from {{old_plan}} to {{new_plan}}.', 'Valid until {{expiry_date}}.'], null],
];

export const EVENT_COUNT = E.length;

const PREF_CATEGORY = { security: 'security', payment: 'payments', transactional: 'membership' };

export const CATALOG = E.map((e, sort) => {
  const [key, group, name, category, mandatory] = e;
  return {
    key, group_key: group, name, category, is_mandatory: !!mandatory, sort,
    pref_category: PREF_CATEGORY[category],
    description: `${GROUPS[group]} · ${name}`,
    // WhatsApp and SMS follow the website decision: WhatsApp on (opt-in only), SMS available but off.
    channels: { IN_APP: true, WHATSAPP: true, EMAIL: true, SMS: false },
  };
});

export const prefCategoryOf = (event) => event?.pref_category ?? PREF_CATEGORY[event?.category] ?? 'membership';

const esc = (s) => s;
/** Responsive, table-free-ish email shell. Variables stay as {{...}} until render. */
export function emailHtml(heading, lines, button) {
  const paras = lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155">${esc(l)}</p>`).join('');
  const btn = button
    ? `<p style="margin:20px 0"><a href="{{${button[1]}}}" style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;display:inline-block">${button[0]}</a></p>`
    : '';
  return `<div style="font-family:Inter,Arial,sans-serif;background:#f1f5f9;padding:24px 12px"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden"><div style="padding:18px 24px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a">{{company_name}}</div><div style="padding:24px"><h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">${heading}</h1><p style="margin:0 0 12px;font-size:15px;color:#334155">Hi {{member_name}},</p>${paras}${btn}<p style="margin:20px 0 0;font-size:13px;color:#64748b">Questions? Write to {{support_email}}.<br>— {{company_name}}</p></div></div></div>`;
}

export const varsIn = (text) => [...new Set([...String(text ?? '').matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))];

/** Default English templates for one catalogue entry: IN_APP, WHATSAPP, EMAIL. */
export function defaultTemplates(key) {
  const e = E.find((x) => x[0] === key);
  if (!e) return [];
  const [, , , , , title, msg, url, wa, subject, lines, btn] = e;
  const waVars = varsIn(wa);
  return [
    { event_key: key, channel: 'IN_APP', lang: 'en', title, body: msg, link_url: url, icon: key.startsWith('payment') || key.startsWith('invoice') ? 'payment' : key.split('.')[0] },
    { event_key: key, channel: 'WHATSAPP', lang: 'en', title: null, body: wa, wa_template_name: `membership_${key.replace(/\./g, '_')}_v1`, wa_params: waVars },
    { event_key: key, channel: 'EMAIL', lang: 'en', title: subject, preheader: '{{membership_plan}} · {{amount}}', body: emailHtml(subject, lines, btn), attachments: key === 'payment.succeeded' || key === 'invoice.generated' || key === 'renewal.succeeded' ? ['invoice_pdf'] : [] },
  ];
}
