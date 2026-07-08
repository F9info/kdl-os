import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';
import { searchMedia } from './media-search.service.js';
import { resolveUrls } from './service.js';

// Smart collection rules are a saved search-filter object using the same keys
// as GET /api/media/search (q, type, tags[], meta{}, folder_id, owner_id,
// date_from/to, size_min/max). Unknown keys are dropped so a stale saved rule
// can't inject arbitrary meili options.
const RULE_KEYS = new Set([
  'q', 'type', 'tags', 'meta', 'folder_id', 'owner_id',
  'date_from', 'date_to', 'size_min', 'size_max', 'archived', 'sort',
]);

export const sanitizeRules = (rules) => {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) return {};
  return Object.fromEntries(Object.entries(rules).filter(([k]) => RULE_KEYS.has(k)));
};

export const evaluateSmartCollection = (rules, { page, limit } = {}) =>
  searchMedia({ ...sanitizeRules(rules), page, limit });

export const listCollections = () =>
  prisma.mediaCollection.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { items: true } } },
  });

export const createCollection = async (data, actorId) => {
  const collection = await prisma.mediaCollection.create({
    data: {
      name: data.name,
      is_smart: data.is_smart ?? false,
      rules: data.is_smart ? sanitizeRules(data.rules) : null,
      created_by: actorId,
    },
  });
  writeActivityAsync({ actor: actorId, module: 'media', action: 'collection_created', description: `Collection "${collection.name}" created` });
  return collection;
};

export const updateCollection = async (id, data, actorId) => {
  const existing = await prisma.mediaCollection.findUnique({ where: { id } });
  if (!existing) return null;
  const patch = { ...data };
  if (patch.rules !== undefined) patch.rules = sanitizeRules(patch.rules);
  const collection = await prisma.mediaCollection.update({ where: { id }, data: patch });
  writeActivityAsync({ actor: actorId, module: 'media', action: 'collection_updated', description: `Collection "${collection.name}" updated` });
  return collection;
};

export const deleteCollection = async (id, actorId) => {
  const existing = await prisma.mediaCollection.findUnique({ where: { id } });
  if (!existing) return null;
  await prisma.mediaCollection.delete({ where: { id } }); // items cascade
  writeActivityAsync({ actor: actorId, module: 'media', action: 'collection_deleted', description: `Collection "${existing.name}" deleted` });
  return existing;
};

export const addCollectionItems = async (collectionId, mediaIds, actorId) => {
  const collection = await prisma.mediaCollection.findUnique({ where: { id: collectionId } });
  if (!collection) return null;
  if (collection.is_smart) {
    throw Object.assign(new Error('Smart collections are rule-based; items cannot be added manually'), { status: 422 });
  }
  const found = await prisma.media.findMany({
    where: { id: { in: mediaIds }, deleted_at: null },
    select: { id: true },
  });
  await prisma.mediaCollectionItem.createMany({
    data: found.map((m) => ({ collection_id: collectionId, media_id: m.id })),
    skipDuplicates: true,
  });
  writeActivityAsync({ actor: actorId, module: 'media', action: 'collection_items_added', description: `${found.length} item(s) added to "${collection.name}"` });
  return { added: found.length };
};

export const removeCollectionItems = async (collectionId, mediaIds, actorId) => {
  const collection = await prisma.mediaCollection.findUnique({ where: { id: collectionId } });
  if (!collection) return null;
  const result = await prisma.mediaCollectionItem.deleteMany({
    where: { collection_id: collectionId, media_id: { in: mediaIds } },
  });
  writeActivityAsync({ actor: actorId, module: 'media', action: 'collection_items_removed', description: `${result.count} item(s) removed from "${collection.name}"` });
  return { removed: result.count };
};

// Static collections read from the DB; smart ones evaluate saved rules via search
export const getCollectionContents = async (id, { page = 1, limit = 24 } = {}) => {
  const collection = await prisma.mediaCollection.findUnique({ where: { id } });
  if (!collection) return null;
  if (collection.is_smart) {
    const result = await evaluateSmartCollection(collection.rules ?? {}, { page, limit });
    return { collection, ...result };
  }
  const take = Math.min(100, Math.max(1, Number(limit) || 24));
  const currentPage = Math.max(1, Number(page) || 1);
  const where = { collection_id: id, media: { deleted_at: null } };
  const [items, total] = await Promise.all([
    prisma.mediaCollectionItem.findMany({
      where,
      include: { media: true },
      orderBy: { created_at: 'desc' },
      skip: (currentPage - 1) * take,
      take,
    }),
    prisma.mediaCollectionItem.count({ where }),
  ]);
  return {
    collection,
    hits: await Promise.all(items.map((i) => resolveUrls(i.media))),
    pagination: { page: currentPage, limit: take, total, pages: Math.ceil(total / take) },
  };
};

// ─── Favorites ───────────────────────────────────────────────────────────────

export const favoriteMedia = async (userId, mediaId) => {
  const media = await prisma.media.findFirst({ where: { id: mediaId, deleted_at: null } });
  if (!media) return null;
  await prisma.mediaFavorite.upsert({
    where: { user_id_media_id: { user_id: userId, media_id: mediaId } },
    create: { user_id: userId, media_id: mediaId },
    update: {},
  });
  return { favorited: true };
};

export const unfavoriteMedia = async (userId, mediaId) => {
  await prisma.mediaFavorite.deleteMany({ where: { user_id: userId, media_id: mediaId } });
  return { favorited: false };
};

export const listFavorites = async (userId, { page = 1, limit = 24 } = {}) => {
  const take = Math.min(100, Math.max(1, Number(limit) || 24));
  const currentPage = Math.max(1, Number(page) || 1);
  const where = { user_id: userId, media: { deleted_at: null } };
  const [rows, total] = await Promise.all([
    prisma.mediaFavorite.findMany({
      where,
      include: { media: true },
      orderBy: { created_at: 'desc' },
      skip: (currentPage - 1) * take,
      take,
    }),
    prisma.mediaFavorite.count({ where }),
  ]);
  return {
    media: await Promise.all(rows.map((r) => resolveUrls(r.media))),
    pagination: { page: currentPage, limit: take, total, pages: Math.ceil(total / take) },
  };
};

// ─── Recents ─────────────────────────────────────────────────────────────────

// Called on picker-select and download
export const touchMedia = async (mediaId) => {
  const media = await prisma.media.findFirst({ where: { id: mediaId, deleted_at: null } });
  if (!media) return null;
  return prisma.media.update({ where: { id: mediaId }, data: { last_used_at: new Date() } });
};

export const listRecents = async ({ page = 1, limit = 24 } = {}) => {
  const take = Math.min(100, Math.max(1, Number(limit) || 24));
  const currentPage = Math.max(1, Number(page) || 1);
  const where = { deleted_at: null, last_used_at: { not: null } };
  const [rows, total] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy: { last_used_at: 'desc' },
      skip: (currentPage - 1) * take,
      take,
    }),
    prisma.media.count({ where }),
  ]);
  return {
    media: await Promise.all(rows.map(resolveUrls)),
    pagination: { page: currentPage, limit: take, total, pages: Math.ceil(total / take) },
  };
};
