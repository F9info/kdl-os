import { prisma } from '../../config/database.js';

const CATEGORIES = [
  { slug: 'system', name: 'System', description: 'Platform-wide announcements and maintenance notices' },
  { slug: 'security', name: 'Security', description: 'Password changes, new logins, and other security events' },
  { slug: 'account', name: 'Account', description: 'Account lifecycle events such as welcome and profile changes' },
  { slug: 'activity', name: 'Activity', description: 'Activity on entities you own or follow' },
];

const TEMPLATES = [
  {
    slug: 'user.welcome',
    category_slug: 'account',
    name: 'Welcome',
    variables: ['user_name'],
    in_app_body: 'Welcome to the platform, {{user_name}}!',
    email_subject: 'Welcome, {{user_name}}!',
    email_body: '<p>Hi {{user_name}},</p><p>Your account has been created. Welcome aboard!</p>',
    sms_body: 'Welcome, {{user_name}}! Your account is ready.',
    whatsapp_body: 'Welcome, {{user_name}}! Your account is ready.',
  },
  {
    slug: 'security.password-changed',
    category_slug: 'security',
    name: 'Password changed',
    variables: ['user_name'],
    in_app_body: 'Your password was changed. If this was not you, contact support immediately.',
    email_subject: 'Your password was changed',
    email_body: '<p>Hi {{user_name}},</p><p>Your password was just changed. If this was not you, contact support immediately.</p>',
    sms_body: 'Your password was changed. Not you? Contact support.',
    whatsapp_body: 'Your password was changed. Not you? Contact support.',
  },
  {
    slug: 'security.new-login',
    category_slug: 'security',
    name: 'New login',
    variables: ['user_name', 'ip_address', 'user_agent'],
    in_app_body: 'New login to your account from {{ip_address}} ({{user_agent}}).',
    email_subject: 'New login to your account',
    email_body: '<p>Hi {{user_name}},</p><p>We detected a new login from {{ip_address}} ({{user_agent}}). If this was not you, secure your account.</p>',
    sms_body: 'New login from {{ip_address}}. Not you? Secure your account.',
    whatsapp_body: 'New login from {{ip_address}}. Not you? Secure your account.',
  },
  {
    slug: 'system.broadcast',
    category_slug: 'system',
    name: 'System broadcast',
    variables: ['title', 'message'],
    in_app_body: '{{message}}',
    email_subject: '{{title}}',
    email_body: '<p>{{message}}</p>',
    sms_body: '{{message}}',
    whatsapp_body: '{{message}}',
  },
];

export async function seedNotifications(prismaClient = prisma) {
  const categoryIds = {};
  for (const cat of CATEGORIES) {
    const row = await prismaClient.notificationCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, is_system: true },
      create: { ...cat, is_system: true },
    });
    categoryIds[cat.slug] = row.id;
  }

  for (const { category_slug, ...tpl } of TEMPLATES) {
    const category_id = categoryIds[category_slug];
    await prismaClient.notificationTemplate.upsert({
      where: { slug: tpl.slug },
      update: { ...tpl, category_id },
      create: { ...tpl, category_id },
    });
  }

  console.log(
    `notifications.seed: upserted ${CATEGORIES.length} categories, ${TEMPLATES.length} templates`
  );
}
