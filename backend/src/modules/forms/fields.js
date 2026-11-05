import { z } from 'zod';

// Field definitions of a form and validation of a visitor's submission against them. Pure: no I/O.
export const FIELD_TYPES = ['text', 'email', 'tel', 'textarea'];
const MAX_VALUE = { text: 200, email: 254, tel: 40, textarea: 4000 };

export const fieldsSchema = z
  .array(
    z.object({
      key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, 'key must be lowercase letters, numbers, underscores'),
      label: z.string().trim().min(1).max(100),
      type: z.enum(FIELD_TYPES),
      required: z.boolean().default(false),
    })
  )
  .min(1)
  .max(20)
  .refine((fields) => new Set(fields.map((f) => f.key)).size === fields.length, 'field keys must be unique');

/** The fields every new form starts with. */
export const DEFAULT_FIELDS = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'message', label: 'Message', type: 'textarea', required: false },
];

/**
 * Checks `input` against the form's fields. Unknown keys are dropped.
 * Returns { data } (trimmed values, empty optional fields omitted) or { errors: { key: message } }.
 */
export function validateSubmission(fields, input) {
  const data = {};
  const errors = {};
  const source = input && typeof input === 'object' ? input : {};
  for (const field of fields) {
    const raw = source[field.key];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) {
      if (field.required) errors[field.key] = `${field.label} is required`;
      continue;
    }
    if (value.length > MAX_VALUE[field.type]) errors[field.key] = `${field.label} is too long`;
    else if (field.type === 'email' && !z.string().email().safeParse(value).success)
      errors[field.key] = `${field.label} must be a valid email`;
    else data[field.key] = value;
  }
  return Object.keys(errors).length ? { errors } : { data };
}

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

/** Email body for a new submission. Every visitor-supplied value is HTML-escaped. */
export const notificationHtml = (form, data) =>
  `<h3>New submission: ${escapeHtml(form.name)}</h3>` +
  form.fields
    .filter((f) => data[f.key] !== undefined)
    .map(
      (f) =>
        `<p><strong>${escapeHtml(f.label)}</strong><br>${escapeHtml(data[f.key]).replace(/\n/g, '<br>')}</p>`
    )
    .join('');
