import { prisma } from '../../config/database.js';
import { PRESETS } from './presets.js';
import { httpError, notFound, recordEvent } from './util.js';

const include = { fields: { orderBy: { sort: 'asc' } }, _count: { select: { plans: true } } };
const dup = (e, msg) => {
  if (e.code === 'P2002') throw httpError(409, msg);
  if (e.code === 'P2025') throw notFound('Field pack');
  throw e;
};

export const listGroups = () => prisma.membershipFieldGroup.findMany({ include, orderBy: [{ sort: 'asc' }, { name: 'asc' }] });
export const listPresets = () => Object.entries(PRESETS).map(([key, p]) => ({ key, name: p.name, icon: p.icon, applies_to: p.applies_to, field_count: p.fields.length, fields: p.fields }));

export async function createGroup({ fields = [], ...body }, actor) {
  try {
    const g = await prisma.membershipFieldGroup.create({ data: { ...body, fields: { create: fields.map((f, sort) => ({ sort, ...f })) } }, include });
    await recordEvent(prisma, { key: 'fields.group_created', actor, data: { group_id: g.id }, description: `Field pack ${g.name} created` });
    return g;
  } catch (e) {
    return dup(e, 'A field pack with this key already exists');
  }
}

export async function updateGroup(id, body, actor) {
  try {
    const g = await prisma.membershipFieldGroup.update({ where: { id }, data: body, include });
    await recordEvent(prisma, { key: 'fields.group_updated', actor, data: { group_id: id }, description: `Field pack ${g.name} updated` });
    return g;
  } catch (e) {
    return dup(e, 'A field pack with this key already exists');
  }
}

export async function removeGroup(id, actor) {
  const g = await prisma.membershipFieldGroup.findUnique({ where: { id }, include: { fields: { include: { _count: { select: { values: true } } } } } });
  if (!g) throw notFound('Field pack');
  if (g.fields.some((f) => f._count.values > 0)) {
    await prisma.membershipFieldGroup.update({ where: { id }, data: { is_active: false } });
    return { deleted: false, deactivated: true };
  }
  await prisma.membershipFieldGroup.delete({ where: { id } });
  await recordEvent(prisma, { key: 'fields.group_deleted', actor, data: { group_id: id }, description: `Field pack ${g.name} deleted` });
  return { deleted: true, deactivated: false };
}

export async function addField(groupId, body, actor) {
  if (!(await prisma.membershipFieldGroup.findUnique({ where: { id: groupId }, select: { id: true } }))) throw notFound('Field pack');
  try {
    const f = await prisma.membershipField.create({ data: { ...body, group_id: groupId, sort: body.sort ?? (await prisma.membershipField.count({ where: { group_id: groupId } })) } });
    await recordEvent(prisma, { key: 'fields.field_created', actor, data: { field_id: f.id }, description: `Field ${f.label} created` });
    return f;
  } catch (e) {
    return dup(e, 'This pack already has a field with that key');
  }
}

export async function updateField(id, body, actor) {
  try {
    const f = await prisma.membershipField.update({ where: { id }, data: body });
    await recordEvent(prisma, { key: 'fields.field_updated', actor, data: { field_id: id }, description: `Field ${f.label} updated` });
    return f;
  } catch (e) {
    if (e.code === 'P2025') throw notFound('Field');
    return dup(e, 'This pack already has a field with that key');
  }
}

export async function removeField(id, actor) {
  const f = await prisma.membershipField.findUnique({ where: { id }, include: { _count: { select: { values: true } } } });
  if (!f) throw notFound('Field');
  if (f._count.values > 0) throw httpError(409, 'Members already answered this field; remove the answers first or hide the field');
  await prisma.membershipField.delete({ where: { id } });
  await recordEvent(prisma, { key: 'fields.field_deleted', actor, data: { field_id: id }, description: `Field ${f.label} deleted` });
  return { deleted: true };
}

/** Create the pack (or top up a pack that already exists) from one of the seven presets. */
export async function applyPreset(preset, actor) {
  const def = PRESETS[preset];
  if (!def) throw httpError(422, 'Unknown preset');
  const key = preset.toLowerCase();
  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.membershipFieldGroup.upsert({
      where: { key },
      create: { key, name: def.name, icon: def.icon, applies_to: def.applies_to, preset_key: preset, sort: Object.keys(PRESETS).indexOf(preset) },
      update: { is_active: true },
    });
    const have = new Set((await tx.membershipField.findMany({ where: { group_id: g.id }, select: { key: true } })).map((f) => f.key));
    const add = def.fields.filter((f) => !have.has(f.key)).map((f, sort) => ({ ...f, group_id: g.id, sort: have.size + sort }));
    if (add.length) await tx.membershipField.createMany({ data: add });
    return g;
  });
  await recordEvent(prisma, { key: 'fields.preset_applied', actor, data: { preset }, description: `Field pack preset ${preset} applied` });
  return prisma.membershipFieldGroup.findUnique({ where: { id: group.id }, include });
}
