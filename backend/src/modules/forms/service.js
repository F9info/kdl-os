import { prisma } from '../../config/database.js';
import { getDefaultProjectId } from '../../shared/default-project.js';
import { logger } from '../../shared/utils/logger.js';
import { sendEmail } from '../../shared/services/email.service.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';
import { DEFAULT_FIELDS, validateSubmission, notificationHtml } from './fields.js';

const httpError = (status, message, extra) => Object.assign(new Error(message), { status, ...extra });

const projectIdOrThrow = async () => {
  const id = await getDefaultProjectId(prisma);
  if (!id) throw httpError(404, 'No project found');
  return id;
};

const findForm = async (id) => {
  const form = await prisma.form.findFirst({
    where: { id, project_id: await projectIdOrThrow(), deleted_at: null },
  });
  if (!form) throw httpError(404, 'Form not found');
  return form;
};

// notify_email '' means "clear it".
const clean = (body) => ({ ...body, ...(body.notify_email === '' ? { notify_email: null } : {}) });

export const listForms = async () =>
  prisma.form.findMany({
    where: { project_id: await projectIdOrThrow(), deleted_at: null },
    orderBy: { created_at: 'desc' },
    include: { _count: { select: { submissions: true } } },
  });

export const createForm = async (body, actorId, client = prisma, projectId) => {
  const project_id = projectId ?? (await projectIdOrThrow());
  try {
    const form = await client.form.create({
      data: { fields: DEFAULT_FIELDS, ...clean(body), project_id },
    });
    writeActivityAsync({
      actor: actorId,
      module: 'forms',
      action: 'created',
      subject_type: 'Form',
      subject_id: form.id,
      description: `Form "${form.name}" created`,
    });
    return form;
  } catch (err) {
    if (err.code === 'P2002') throw httpError(409, `The slug "${body.slug}" is already in use`);
    throw err;
  }
};

export const updateForm = async (id, body, actorId) => {
  await findForm(id);
  const form = await prisma.form.update({ where: { id }, data: clean(body) });
  writeActivityAsync({
    actor: actorId,
    module: 'forms',
    action: 'updated',
    subject_type: 'Form',
    subject_id: id,
    description: `Form "${form.name}" updated`,
  });
  return form;
};

export const deleteForm = async (id, actorId) => {
  const form = await findForm(id);
  await prisma.form.update({ where: { id }, data: { deleted_at: new Date() } });
  writeActivityAsync({
    actor: actorId,
    module: 'forms',
    action: 'deleted',
    subject_type: 'Form',
    subject_id: id,
    description: `Form "${form.name}" deleted`,
  });
};

export const listSubmissions = async (id, limit) => {
  await findForm(id);
  return prisma.formSubmission.findMany({
    where: { form_id: id },
    orderBy: { created_at: 'desc' },
    take: limit,
    select: { id: true, data: true, created_at: true },
  });
};

// ── Public ───────────────────────────────────────────────────────────────────

const findPublicForm = async (slug) => {
  const projectId = await getDefaultProjectId(prisma);
  const form = projectId
    ? await prisma.form.findFirst({
        where: { project_id: projectId, slug, is_active: true, deleted_at: null },
      })
    : null;
  if (!form) throw httpError(404, 'Form not found');
  return form;
};

/** What the ContactForm block needs to draw the form. Never exposes notify_email. */
export const getPublicForm = async (slug) => {
  const { name, fields, submit_label, success_message } = await findPublicForm(slug);
  return { name, fields, submit_label, success_message };
};

/**
 * Stores a visitor's submission and emails the owner. `_hp` is a honeypot input hidden from people:
 * a bot that fills it gets a normal success answer but nothing is stored.
 */
export const submitForm = async (slug, body, ip) => {
  const form = await findPublicForm(slug);
  if (body?._hp) return { message: form.success_message };
  const result = validateSubmission(form.fields, body);
  if (result.errors) throw httpError(422, 'Please check the form', { errors: result.errors });
  await prisma.formSubmission.create({
    data: { form_id: form.id, data: result.data, ip_address: ip ?? null },
  });
  if (form.notify_email) {
    // Never fail or slow the visitor's request because the email could not be sent.
    sendEmail(
      form.notify_email,
      `New submission: ${form.name}`.replace(/[\r\n]+/g, ' '),
      notificationHtml(form, result.data)
    ).catch((err) => logger.warn(`forms: notification for "${form.slug}" failed: ${err.message}`));
  }
  return { message: form.success_message };
};
