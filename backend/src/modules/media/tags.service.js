import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';
import { enqueueReindex } from './media-search.service.js';

// Tags are stored normalized (lowercase, single-spaced) so "Logo Design" and
// "logo  design" resolve to the same tag.
export const normalizeTagName = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export const listTags = () =>
  prisma.mediaTag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { media: true } } },
  });

export const createTag = async (name, actorId) => {
  const tag = await prisma.mediaTag.create({ data: { name: normalizeTagName(name) } });
  writeActivityAsync({ actor: actorId, module: 'media', action: 'tag_created', description: `Tag "${tag.name}" created` });
  return tag;
};

export const renameTag = async (id, name, actorId) => {
  const existing = await prisma.mediaTag.findUnique({ where: { id } });
  if (!existing) return null;
  const tag = await prisma.mediaTag.update({ where: { id }, data: { name: normalizeTagName(name) } });
  writeActivityAsync({ actor: actorId, module: 'media', action: 'tag_renamed', description: `Tag "${existing.name}" renamed to "${tag.name}"` });
  return tag;
};

export const deleteTag = async (id, actorId) => {
  const existing = await prisma.mediaTag.findUnique({ where: { id } });
  if (!existing) return null;
  await prisma.mediaTag.delete({ where: { id } });
  writeActivityAsync({ actor: actorId, module: 'media', action: 'tag_deleted', description: `Tag "${existing.name}" deleted` });
  return existing;
};

const upsertTagsByName = (names) =>
  Promise.all(names.map((name) =>
    prisma.mediaTag.upsert({ where: { name }, create: { name }, update: {} })
  ));

// Bulk tag: attach every tag (created on demand) to every non-deleted media id.
export const tagMedia = async (mediaIds, tagNames, actorId) => {
  const names = [...new Set(tagNames.map(normalizeTagName).filter(Boolean))];
  if (!names.length) return { tagged: 0, tags: [] };
  const tags = await upsertTagsByName(names);
  const found = await prisma.media.findMany({
    where: { id: { in: mediaIds }, deleted_at: null },
    select: { id: true },
  });
  const rows = found.flatMap((m) => tags.map((t) => ({ media_id: m.id, tag_id: t.id })));
  if (rows.length) await prisma.mediaTagPivot.createMany({ data: rows, skipDuplicates: true });
  found.forEach((m) => enqueueReindex(m.id));
  writeActivityAsync({ actor: actorId, module: 'media', action: 'tagged', description: `${found.length} file(s) tagged: ${names.join(', ')}` });
  return { tagged: found.length, tags: names };
};

export const untagMedia = async (mediaIds, tagNames, actorId) => {
  const names = [...new Set(tagNames.map(normalizeTagName).filter(Boolean))];
  if (!names.length) return { removed: 0 };
  const tags = await prisma.mediaTag.findMany({ where: { name: { in: names } } });
  if (!tags.length) return { removed: 0 };
  const result = await prisma.mediaTagPivot.deleteMany({
    where: { media_id: { in: mediaIds }, tag_id: { in: tags.map((t) => t.id) } },
  });
  mediaIds.forEach((mid) => enqueueReindex(mid));
  writeActivityAsync({ actor: actorId, module: 'media', action: 'untagged', description: `${result.count} tag link(s) removed: ${names.join(', ')}` });
  return { removed: result.count };
};

// Replace semantics for PATCH /media/:id { tags: [...] } — the list is the new truth.
export const setMediaTags = async (mediaId, tagNames) => {
  const names = [...new Set(tagNames.map(normalizeTagName).filter(Boolean))];
  const tags = await upsertTagsByName(names);
  const keepIds = tags.map((t) => t.id);
  await prisma.mediaTagPivot.deleteMany({ where: { media_id: mediaId, tag_id: { notIn: keepIds } } });
  if (keepIds.length) {
    await prisma.mediaTagPivot.createMany({
      data: keepIds.map((tag_id) => ({ media_id: mediaId, tag_id })),
      skipDuplicates: true,
    });
  }
  return names;
};
