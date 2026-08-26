import { randomUUID } from 'crypto';
import { prisma } from '../../config/database.js';
import { getPaginationParams } from '../../shared/utils/pagination.js';
import { uniqueSlug } from '../../shared/utils/slug.js';
import * as storageService from '../../shared/services/storage.service.js';
import { FILE_INPUT_TYPES } from '../../shared/constants/inputTypes.js';

const SORTABLE = ['field_name', 'created_at', 'sort'];
const FIELD_INCLUDE = {
  type: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true } },
};

// MinIO object prefix for files uploaded through Application Settings fields.
const SETTING_FILE_PREFIX = 'settings';

// The generic admin API manages only standalone rows (owner_module = null).
// Module-owned rows (e.g. theme-engine) must never be mutated or deleted here,
// and generic writes may only reference standalone types/categories.
const WRITABLE = { owner_module: null };

export const listFields = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where = { owner_module: query.ownerModule ?? null };
  if (query.search) where.field_name = { contains: query.search, mode: 'insensitive' };
  if (query.type_id) where.type_id = query.type_id;
  if (query.category_id) where.category_id = query.category_id;
  if (query.input_type) where.input_type = query.input_type;

  const sortBy = SORTABLE.includes(query.sortBy) ? query.sortBy : 'sort';
  const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';

  const [fields, total] = await Promise.all([
    prisma.settingField.findMany({
      where,
      include: FIELD_INCLUDE,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.settingField.count({ where }),
  ]);

  return { fields, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const getFieldById = (id) =>
  prisma.settingField.findUnique({ where: { id }, include: FIELD_INCLUDE });

// Existence check for generic write paths — resolves only standalone fields.
export const getWritableFieldById = (id) =>
  prisma.settingField.findFirst({ where: { id, ...WRITABLE }, include: FIELD_INCLUDE });

export const createField = async (data) => {
  const slug = await uniqueSlug(prisma.settingField, data.field_name);
  // New fields go to the bottom of their Type's list unless an explicit sort is given.
  let { sort } = data;
  if (sort === undefined) {
    const last = await prisma.settingField.findFirst({
      where: { type_id: data.type_id },
      orderBy: { sort: 'desc' },
      select: { sort: true },
    });
    sort = last ? last.sort + 1 : 0;
  }
  return prisma.settingField.create({
    data: { ...data, slug, sort },
    include: FIELD_INCLUDE,
  });
};

export const updateField = async (id, data) => {
  const updateData = { ...data };
  if (data.field_name !== undefined) {
    updateData.slug = await uniqueSlug(prisma.settingField, data.field_name, id);
  }
  // Scope the write so module-owned rows can't be mutated; null signals not-found.
  const { count } = await prisma.settingField.updateMany({
    where: { id, ...WRITABLE },
    data: updateData,
  });
  if (count === 0) return null;
  return prisma.settingField.findUnique({ where: { id }, include: FIELD_INCLUDE });
};

export const deleteField = async (id) => {
  // Resolve only standalone fields so module-owned rows can't be deleted here.
  const field = await prisma.settingField.findFirst({ where: { id, ...WRITABLE } });
  if (field) {
    await removeStoredFiles(field);
    await prisma.settingField.delete({ where: { id } });
  }
  return field;
};

// Persist a new sort order. `ids` is the desired order; index becomes `sort`.
// Scoped to standalone fields so module-owned rows keep their engine-defined order.
export const reorderFields = async (ids) => {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.settingField.updateMany({ where: { id, ...WRITABLE }, data: { sort: index } })
    )
  );
};

// Generic writes may only reference standalone types/categories.
export const typeExists = (id) =>
  prisma.type.findFirst({ where: { id, ...WRITABLE }, select: { id: true } });

export const categoryExists = (id) =>
  prisma.category.findFirst({ where: { id, ...WRITABLE }, select: { id: true } });

// Used only by the generic Application-Settings "view by slug" screen — module-owned
// Types (owner_module set) are excluded so engine internals aren't editable there.
export const getTypeBySlug = (slug) =>
  prisma.type.findFirst({ where: { slug, owner_module: null } });

// Returns all fields for a Type (by slug), ordered for rendering, with file values
// resolved to fresh presigned URLs for display (never persisted — per storage rules).
export const getFieldsForType = async (typeId) => {
  const fields = await prisma.settingField.findMany({
    where: { type_id: typeId },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { sort: 'asc' },
  });
  return Promise.all(fields.map(withDisplayValue));
};

// Bulk-save submitted values for a Type's fields. Only fields belonging to the
// given type are updated; unknown ids and valueless types (heading) are ignored.
export const saveValues = async (typeId, values) => {
  // Only standalone fields are writable through the generic values endpoint.
  const fields = await prisma.settingField.findMany({ where: { type_id: typeId, ...WRITABLE } });
  const byId = new Map(fields.map((f) => [f.id, f]));

  const updates = [];
  for (const entry of values) {
    const field = byId.get(entry.id);
    if (!field || field.input_type === 'heading') continue;
    updates.push(
      prisma.settingField.update({
        where: { id: field.id },
        data: {
          value: entry.value ?? null,
          alt_text: entry.alt_text ?? null,
        },
      })
    );
  }
  if (updates.length) await prisma.$transaction(updates);
  return updates.length;
};

// Read one field's value by slug — the `applicationSettings('slug')` equivalent.
export const getValueBySlug = async (slug) => {
  const field = await prisma.settingField.findUnique({ where: { slug } });
  if (!field) return null;
  return withDisplayValue(field);
};

// Brand-kit (template-engine intake logo upload) writes straight into the
// global `logo` field so the admin sidebar/dashboard immediately reflect
// the active project's logo — see uploadLogo() in
// backend/src/modules/brand-kit/service.js. `path` is a raw storage object
// path (Media.path), same format this field already stores for a manual
// Theme Settings upload. Silently no-ops if the field doesn't exist.
export const setGlobalLogo = async (path) => {
  await prisma.settingField.updateMany({ where: { slug: 'logo' }, data: { value: path } });
};

// Upload a file for a setting field and return its object path + presigned URL.
export const uploadSettingFile = async (file) => {
  const ext = file.originalname.split('.').pop().toLowerCase();
  const objectName = `${SETTING_FILE_PREFIX}/${randomUUID()}.${ext}`;
  await storageService.uploadFile(file, objectName);
  const url = await storageService.getFileUrl(objectName);
  return { path: objectName, url };
};

// Remove one image from a multiple-files field's JSON array and delete it from storage.
export const removeGalleryItem = async (id, index) => {
  // Scoped to standalone fields — module-owned galleries aren't editable here.
  const field = await prisma.settingField.findFirst({ where: { id, ...WRITABLE } });
  if (!field || field.input_type !== 'multiple-files') return null;

  const paths = parseJsonArray(field.value);
  if (index < 0 || index >= paths.length) return field;

  const [removed] = paths.splice(index, 1);
  if (removed) {
    try {
      await storageService.deleteFile(removed);
    } catch {
      // Object may already be gone; the DB record is the source of truth.
    }
  }
  return prisma.settingField.update({
    where: { id },
    data: { value: paths.length ? JSON.stringify(paths) : null },
  });
};

// ---- helpers ----

const parseJsonArray = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Attaches a `value_url` (single file) or `value_urls` (gallery) of fresh presigned
// URLs so the client can display stored files without us persisting expiring URLs.
const withDisplayValue = async (field) => {
  if (field.input_type === 'file' && field.value) {
    return { ...field, value_url: await storageService.getFileUrl(field.value) };
  }
  if (field.input_type === 'multiple-files') {
    const paths = parseJsonArray(field.value);
    const value_urls = await Promise.all(
      paths.map(async (p) => ({ path: p, url: await storageService.getFileUrl(p) }))
    );
    return { ...field, value_urls };
  }
  return field;
};

const removeStoredFiles = async (field) => {
  if (!FILE_INPUT_TYPES.includes(field.input_type) || !field.value) return;
  const paths = field.input_type === 'multiple-files' ? parseJsonArray(field.value) : [field.value];
  await Promise.all(
    paths.map((p) => storageService.deleteFile(p).catch(() => {}))
  );
};
