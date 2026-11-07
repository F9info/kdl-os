// Theme looks (six quick colours, light and dark) in the database (T10). preset-defaults.js is only the seed.
import { prisma } from '../../config/database.js';
import { BUILTIN_PRESETS } from './preset-defaults.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });
const SELECT = { key: true, name: true, light: true, dark: true, builtin: true };
const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function ensureBuiltinPresets(client = prisma) {
  const have = new Set((await client.themePreset.findMany({ where: { builtin: true }, select: { key: true } })).map((r) => r.key));
  for (const p of BUILTIN_PRESETS) {
    const key = slugOf(p.name);
    if (have.has(key)) continue;
    await client.themePreset.upsert({ where: { key }, update: {}, create: { key, name: p.name, light: p.light, dark: p.dark, builtin: true } });
  }
}

export async function listPresets(client = prisma) {
  await ensureBuiltinPresets(client);
  return client.themePreset.findMany({ where: { deleted_at: null }, orderBy: [{ builtin: 'desc' }, { created_at: 'asc' }], select: SELECT });
}

async function getPreset(key, client) {
  await ensureBuiltinPresets(client);
  const row = await client.themePreset.findFirst({ where: { key, deleted_at: null } });
  if (!row) throw httpError(404, 'Unknown preset');
  return row;
}

export async function createPreset({ name, light, dark }, actorId, client = prisma) {
  const key = `${slugOf(name) || 'preset'}-${Math.random().toString(36).slice(2, 7)}`;
  return client.themePreset.create({ data: { key, name, light, dark, builtin: false, created_by: actorId }, select: SELECT });
}

export async function updatePreset(key, patch, client = prisma) {
  const row = await getPreset(key, client);
  return client.themePreset.update({ where: { id: row.id }, data: patch, select: SELECT });
}

export async function duplicatePreset(key, { name }, actorId, client = prisma) {
  const src = await getPreset(key, client);
  return createPreset({ name: name?.trim() || `${src.name} (copy)`, light: src.light, dark: src.dark }, actorId, client);
}

export async function deletePreset(key, client = prisma) {
  const row = await getPreset(key, client);
  await client.themePreset.update({ where: { id: row.id }, data: { deleted_at: new Date() } });
}
