import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

export const listMetaFields = () =>
  prisma.mediaMetaField.findMany({ orderBy: { label: 'asc' } });

export const createMetaField = async (data, actorId) => {
  const field = await prisma.mediaMetaField.create({
    data: {
      slug: data.slug,
      label: data.label,
      field_type: data.field_type ?? 'TEXT',
      options: data.options ?? null,
    },
  });
  writeActivityAsync({ actor: actorId, module: 'media', action: 'meta_field_created', description: `Meta field "${field.label}" (${field.slug}) created` });
  return field;
};

export const updateMetaField = async (id, data, actorId) => {
  const existing = await prisma.mediaMetaField.findUnique({ where: { id } });
  if (!existing) return null;
  if (existing.is_system && (data.slug || data.field_type)) {
    throw Object.assign(new Error('System fields cannot change slug or type'), { status: 422 });
  }
  const field = await prisma.mediaMetaField.update({ where: { id }, data });
  writeActivityAsync({ actor: actorId, module: 'media', action: 'meta_field_updated', description: `Meta field "${field.label}" updated` });
  return field;
};

export const deleteMetaField = async (id, actorId) => {
  const existing = await prisma.mediaMetaField.findUnique({ where: { id } });
  if (!existing) return null;
  if (existing.is_system) {
    throw Object.assign(new Error('System fields cannot be deleted'), { status: 422 });
  }
  await prisma.mediaMetaField.delete({ where: { id } }); // values cascade
  writeActivityAsync({ actor: actorId, module: 'media', action: 'meta_field_deleted', description: `Meta field "${existing.label}" deleted` });
  return existing;
};

const validateValue = (field, value) => {
  if (field.field_type === 'NUMBER' && !Number.isFinite(Number(value))) {
    throw Object.assign(new Error(`"${field.slug}" expects a number`), { status: 422 });
  }
  if (field.field_type === 'DATE' && Number.isNaN(Date.parse(value))) {
    throw Object.assign(new Error(`"${field.slug}" expects a date`), { status: 422 });
  }
  if (field.field_type === 'SELECT') {
    const options = Array.isArray(field.options) ? field.options : [];
    if (!options.includes(value)) {
      throw Object.assign(new Error(`"${field.slug}" must be one of: ${options.join(', ')}`), { status: 422 });
    }
  }
};

// Merge semantics for PATCH /media/:id { meta: {slug: value} } — only listed
// slugs change; null or '' clears a value.
export const setMediaMeta = async (mediaId, meta) => {
  const slugs = Object.keys(meta);
  if (!slugs.length) return;
  const fields = await prisma.mediaMetaField.findMany({ where: { slug: { in: slugs } } });
  const bySlug = new Map(fields.map((f) => [f.slug, f]));
  const unknown = slugs.filter((s) => !bySlug.has(s));
  if (unknown.length) {
    throw Object.assign(new Error(`Unknown meta field(s): ${unknown.join(', ')}`), { status: 422 });
  }
  for (const slug of slugs) {
    const field = bySlug.get(slug);
    const raw = meta[slug];
    if (raw === null || raw === '') {
      await prisma.mediaMetaValue.deleteMany({ where: { media_id: mediaId, field_id: field.id } });
      continue;
    }
    const value = String(raw);
    validateValue(field, value);
    await prisma.mediaMetaValue.upsert({
      where: { media_id_field_id: { media_id: mediaId, field_id: field.id } },
      create: { media_id: mediaId, field_id: field.id, value },
      update: { value },
    });
  }
};
