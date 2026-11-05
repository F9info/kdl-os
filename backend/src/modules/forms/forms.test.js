import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const h = vi.hoisted(() => ({
  prisma: {
    project: { findFirst: vi.fn() },
    form: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    formSubmission: { create: vi.fn(), findMany: vi.fn() },
  },
  sendEmail: vi.fn(),
}));
vi.mock('../../config/database.js', () => ({ prisma: h.prisma }));
vi.mock('../user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
  getClientIp: () => '1.2.3.4',
}));
vi.mock('../../shared/services/email.service.js', () => ({ sendEmail: h.sendEmail }));

const fields = await import('./fields.js');
const service = await import('./service.js');
const { createFormSchema, updateFormSchema } = await import('./schema.js');
const { manifestSchema } = await import('../../shared/modules/manifest-schema.js');

const FORM = {
  id: 'f1',
  slug: 'contact',
  name: 'Contact',
  submit_label: 'Send',
  success_message: 'Thanks!',
  notify_email: 'owner@example.com',
  fields: fields.DEFAULT_FIELDS,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
  h.prisma.form.findFirst.mockResolvedValue(FORM);
  h.sendEmail.mockResolvedValue(undefined);
});

describe('manifest', () => {
  it('is valid and has no sidebar entry (reached from the Brands page)', () => {
    const raw = JSON.parse(readFileSync(new URL('./module.json', import.meta.url), 'utf8'));
    expect(manifestSchema.safeParse(raw).success).toBe(true);
    expect(raw.nav).toEqual([]);
  });
});

describe('validateSubmission', () => {
  const run = (input) => fields.validateSubmission(fields.DEFAULT_FIELDS, input);
  it('accepts valid input, trims, drops unknown keys and empty optional fields', () => {
    expect(run({ name: ' Ann ', email: 'a@b.co', message: '', extra: 'x' }).data).toEqual({
      name: 'Ann',
      email: 'a@b.co',
    });
  });
  it('reports missing required and invalid email', () => {
    expect(run({ email: 'nope' }).errors).toEqual({
      name: 'Name is required',
      email: 'Email must be a valid email',
    });
  });
  it('rejects over-long values and non-string values', () => {
    expect(run({ name: 'x'.repeat(201), email: 'a@b.co' }).errors.name).toMatch(/too long/);
    expect(run({ name: ['a'], email: 'a@b.co' }).errors.name).toMatch(/required/);
    expect(run(null).errors).toBeTruthy();
  });
});

describe('fieldsSchema / create+update schemas', () => {
  it('rejects duplicate keys, bad keys, empty list', () => {
    const f = { key: 'a', label: 'A', type: 'text' };
    expect(fields.fieldsSchema.safeParse([f, f]).success).toBe(false);
    expect(fields.fieldsSchema.safeParse([{ ...f, key: 'Bad Key' }]).success).toBe(false);
    expect(fields.fieldsSchema.safeParse([]).success).toBe(false);
    expect(fields.fieldsSchema.safeParse([f]).data[0].required).toBe(false);
  });
  it('create needs name + slug only; update rejects unknown keys', () => {
    expect(createFormSchema.safeParse({ body: { name: 'A', slug: 'a' } }).success).toBe(true);
    expect(createFormSchema.safeParse({ body: { name: 'A' } }).success).toBe(false);
    expect(updateFormSchema.safeParse({ params: { id: '1' }, body: { project_id: 'x' } }).success).toBe(
      false
    );
  });
});

describe('notificationHtml', () => {
  it('escapes visitor input', () => {
    const html = fields.notificationHtml(FORM, {
      name: '<script>alert(1)</script>',
      email: 'a@b.co',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('submitForm', () => {
  it('stores the submission, emails the owner and returns the success message', async () => {
    const r = await service.submitForm('contact', { name: 'Ann', email: 'a@b.co' }, '9.9.9.9');
    expect(r).toEqual({ message: 'Thanks!' });
    expect(h.prisma.formSubmission.create.mock.calls[0][0].data).toMatchObject({
      form_id: 'f1',
      ip_address: '9.9.9.9',
      data: { name: 'Ann', email: 'a@b.co' },
    });
    expect(h.sendEmail).toHaveBeenCalledWith(
      'owner@example.com',
      'New submission: Contact',
      expect.stringContaining('Ann')
    );
  });
  it('a failing email never fails the visitor', async () => {
    h.sendEmail.mockRejectedValue(new Error('smtp down'));
    await expect(service.submitForm('contact', { name: 'Ann', email: 'a@b.co' })).resolves.toEqual({
      message: 'Thanks!',
    });
  });
  it('no email when notify_email is empty', async () => {
    h.prisma.form.findFirst.mockResolvedValue({ ...FORM, notify_email: null });
    await service.submitForm('contact', { name: 'Ann', email: 'a@b.co' });
    expect(h.sendEmail).not.toHaveBeenCalled();
  });
  it('honeypot: success answer, nothing stored or sent', async () => {
    expect(await service.submitForm('contact', { _hp: 'bot', name: 'x', email: 'a@b.co' })).toEqual({
      message: 'Thanks!',
    });
    expect(h.prisma.formSubmission.create).not.toHaveBeenCalled();
    expect(h.sendEmail).not.toHaveBeenCalled();
  });
  it('422 with per-field errors; nothing stored', async () => {
    await expect(service.submitForm('contact', { name: '' })).rejects.toMatchObject({
      status: 422,
      errors: { name: expect.any(String) },
    });
    expect(h.prisma.formSubmission.create).not.toHaveBeenCalled();
  });
  it('404 for an unknown or inactive form; lookup requires is_active', async () => {
    h.prisma.form.findFirst.mockResolvedValue(null);
    await expect(service.submitForm('nope', {})).rejects.toMatchObject({ status: 404 });
    expect(h.prisma.form.findFirst.mock.calls[0][0].where).toMatchObject({
      is_active: true,
      deleted_at: null,
    });
  });
});

describe('getPublicForm', () => {
  it('never exposes notify_email', async () => {
    const form = await service.getPublicForm('contact');
    expect(form).not.toHaveProperty('notify_email');
    expect(Object.keys(form).sort()).toEqual(['fields', 'name', 'submit_label', 'success_message']);
  });
});

describe('admin service', () => {
  it('createForm: defaults fields, clears empty notify_email, 409 on duplicate slug', async () => {
    h.prisma.form.create.mockResolvedValue({ id: 'f2', name: 'N' });
    await service.createForm({ name: 'N', slug: 'n', notify_email: '' }, 'u1');
    expect(h.prisma.form.create.mock.calls[0][0].data).toMatchObject({
      project_id: 'p1',
      fields: fields.DEFAULT_FIELDS,
      notify_email: null,
    });
    h.prisma.form.create.mockRejectedValue(Object.assign(new Error('x'), { code: 'P2002' }));
    await expect(service.createForm({ name: 'N', slug: 'n' }, 'u1')).rejects.toMatchObject({
      status: 409,
    });
  });
  it('update/delete/submissions 404 when the form is not in this project', async () => {
    h.prisma.form.findFirst.mockResolvedValue(null);
    await expect(service.updateForm('x', {}, 'u')).rejects.toMatchObject({ status: 404 });
    await expect(service.deleteForm('x', 'u')).rejects.toMatchObject({ status: 404 });
    await expect(service.listSubmissions('x', 10)).rejects.toMatchObject({ status: 404 });
  });
  it('deleteForm is a soft delete', async () => {
    await service.deleteForm('f1', 'u');
    expect(h.prisma.form.update.mock.calls[0][0].data.deleted_at).toBeInstanceOf(Date);
  });
});
