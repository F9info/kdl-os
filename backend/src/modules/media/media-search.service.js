import { meili } from '../../config/meilisearch.js';
import { prisma } from '../../config/database.js';
import { logger } from '../../shared/utils/logger.js';

export const MEDIA_INDEX = 'media';

const INDEX_SETTINGS = {
  searchableAttributes: [
    'name', 'title', 'alt', 'caption', 'tags', 'meta_text', 'folder_path', 'owner_name',
    // Phase D fills these; declared now so docs indexed today match later searches
    'ocr_text', 'transcript', 'barcodes',
  ],
  filterableAttributes: [
    'id', // semantic mode (D5) intersects Chroma top-K ids with Meili filters
    'type', 'tags', 'meta_kv', 'folder_id', 'owner_id',
    'created_at_ts', 'size', 'is_archived', 'camera_make', 'camera_model', 'has_gps',
  ],
  sortableAttributes: ['created_at_ts', 'size', 'name'],
};

const SEARCH_INCLUDE = {
  tags: { include: { tag: true } },
  meta_values: { include: { field: true } },
  folder: true,
  user: { select: { id: true, name: true, email: true } },
};

const folderPath = async (folder) => {
  if (!folder) return '';
  const parts = [folder.name];
  let parentId = folder.parent_id;
  // Walk up — folder trees are shallow (UI nests a handful of levels)
  while (parentId) {
    const parent = await prisma.mediaFolder.findUnique({ where: { id: parentId } });
    if (!parent) break;
    parts.unshift(parent.name);
    parentId = parent.parent_id;
  }
  return parts.join('/');
};

// One flat document per media row. meta is exposed three ways: meta_text for
// full-text search, meta_kv ("slug:value") for exact filtering, meta for display.
export const buildMediaDoc = async (media) => {
  const tags = (media.tags ?? []).map((p) => p.tag.name).sort();
  const metaEntries = (media.meta_values ?? []).map((v) => [v.field.slug, v.value]);
  const exif = media.exif ?? {};
  return {
    id: media.id,
    name: media.original_name,
    title: media.title ?? null,
    alt: media.alt_text ?? null,
    caption: media.caption ?? null,
    ocr_text: media.ocr_text ?? null,
    transcript: media.transcript_text ?? null,
    barcodes: Array.isArray(media.barcodes) ? media.barcodes.map((b) => b.value).join(' ') : null,
    tags,
    meta: Object.fromEntries(metaEntries),
    meta_text: metaEntries.map(([, v]) => v).join(' '),
    meta_kv: metaEntries.map(([k, v]) => `${k}:${v}`),
    folder_id: media.folder_id ?? null,
    folder_path: await folderPath(media.folder),
    type: media.type,
    owner_id: media.user_id,
    owner_name: media.user?.name ?? media.user?.email ?? null,
    mime_type: media.mime_type,
    size: media.size,
    width: media.width ?? null,
    height: media.height ?? null,
    camera_make: exif.camera?.make ?? null,
    camera_model: exif.camera?.model ?? null,
    has_gps: Boolean(exif.gps),
    gps: exif.gps ?? null,
    taken_at: exif.taken_at ?? null,
    is_archived: media.is_archived ?? false,
    created_at: media.created_at,
    created_at_ts: media.created_at ? new Date(media.created_at).getTime() : null,
    updated_at: media.updated_at,
  };
};

export const configureMediaIndex = async () => {
  try {
    await meili.getIndex(MEDIA_INDEX);
  } catch {
    await meili.createIndex(MEDIA_INDEX, { primaryKey: 'id' });
  }
  await meili.index(MEDIA_INDEX).updateSettings(INDEX_SETTINGS);
};

export const indexMediaById = async (mediaId) => {
  const media = await prisma.media.findFirst({
    where: { id: mediaId, deleted_at: null },
    include: SEARCH_INCLUDE,
  });
  // Deleted/trashed rows leave the index instead
  if (!media) return removeMediaFromIndex(mediaId);
  const doc = await buildMediaDoc(media);
  return meili.index(MEDIA_INDEX).addDocuments([doc]);
};

export const removeMediaFromIndex = (mediaId) =>
  meili.index(MEDIA_INDEX).deleteDocument(mediaId);

export const reindexAllMedia = async () => {
  await configureMediaIndex();
  const batchSize = 200;
  let cursor;
  let total = 0;
  for (;;) {
    const rows = await prisma.media.findMany({
      where: { deleted_at: null },
      include: SEARCH_INCLUDE,
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });
    if (!rows.length) break;
    const docs = await Promise.all(rows.map(buildMediaDoc));
    await meili.index(MEDIA_INDEX).addDocuments(docs);
    total += rows.length;
    cursor = rows[rows.length - 1].id;
  }
  return { indexed: total };
};

const escapeFilterValue = (v) => `"${String(v).replace(/"/g, '\\"')}"`;

// Translate query params into a meili filter expression
export const buildSearchFilter = (params) => {
  const clauses = [];
  if (params.type) clauses.push(`type = ${escapeFilterValue(params.type)}`);
  if (params.folder_id) clauses.push(`folder_id = ${escapeFilterValue(params.folder_id)}`);
  if (params.owner_id) clauses.push(`owner_id = ${escapeFilterValue(params.owner_id)}`);
  if (params.tags?.length) {
    clauses.push(...params.tags.map((t) => `tags = ${escapeFilterValue(t)}`));
  }
  if (params.meta) {
    for (const [k, v] of Object.entries(params.meta)) {
      clauses.push(`meta_kv = ${escapeFilterValue(`${k}:${v}`)}`);
    }
  }
  if (params.date_from) clauses.push(`created_at_ts >= ${new Date(params.date_from).getTime()}`);
  if (params.date_to) clauses.push(`created_at_ts <= ${new Date(params.date_to).getTime()}`);
  if (params.size_min) clauses.push(`size >= ${Number(params.size_min)}`);
  if (params.size_max) clauses.push(`size <= ${Number(params.size_max)}`);
  if (params.archived === 'true') clauses.push('is_archived = true');
  else if (params.archived !== 'all') clauses.push('is_archived = false');
  return clauses.join(' AND ');
};

export const searchMedia = async (params) => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 24));
  const result = await meili.index(MEDIA_INDEX).search(params.q ?? '', {
    filter: buildSearchFilter(params) || undefined,
    facets: ['type', 'tags', 'folder_id', 'owner_id', 'camera_make'],
    limit,
    offset: (page - 1) * limit,
    sort: params.sort === 'created_at_asc' ? ['created_at_ts:asc']
      : params.sort === 'size_desc' ? ['size:desc']
      : params.sort === 'name_asc' ? ['name:asc']
      : ['created_at_ts:desc'],
  });
  return {
    hits: result.hits,
    facets: result.facetDistribution ?? {},
    pagination: {
      page,
      limit,
      total: result.estimatedTotalHits ?? result.hits.length,
      pages: Math.ceil((result.estimatedTotalHits ?? result.hits.length) / limit),
    },
  };
};

// Fire-and-forget enqueue — search indexing must never fail a mutation
export const enqueueReindex = (mediaId, action = 'index') => {
  import('./media.queue.js')
    .then(({ enqueueSearchIndexJob }) => enqueueSearchIndexJob(mediaId, action))
    .catch((err) => logger.warn(`media search enqueue failed for ${mediaId}: ${err.message}`));
};
