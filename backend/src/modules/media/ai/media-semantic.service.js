import { prisma } from '../../../config/database.js';
import { chroma } from '../../../config/chromadb.js';
import { logger } from '../../../shared/utils/logger.js';
import { getActiveProvider } from './ai-provider.service.js';

export const SEMANTIC_COLLECTION = 'media_semantic';
export const SEMANTIC_TOP_K = 50;

const getCollection = () => chroma.getOrCreateCollection({ name: SEMANTIC_COLLECTION });

/**
 * Flatten a media row (with tags included) into the embedding document text:
 * caption + tags + ocr_text + transcript_text (arch D5). Empty when nothing to embed.
 */
export const buildEmbeddingText = (media) => {
  const tags = (media.tags ?? []).map((p) => p.tag?.name ?? p.name).filter(Boolean);
  return [media.caption, tags.join(' '), media.ocr_text, media.transcript_text]
    .filter((s) => s && String(s).trim())
    .join('\n')
    .trim();
};

/**
 * `ai-embed` processing job: build the doc text and upsert its vector into Chroma.
 * No-ops when the embeddings feature is unconfigured (results always optional).
 */
export const runEmbedJob = async ({ media_id: mediaId }) => {
  const provider = await getActiveProvider('embeddings');
  if (!provider) return { skipped: true, reason: 'embeddings feature not configured' };

  const media = await prisma.media.findFirst({
    where: { id: mediaId, deleted_at: null },
    include: { tags: { include: { tag: true } } },
  });
  const collection = await getCollection();
  if (!media) {
    await collection.delete({ ids: [mediaId] });
    return { removed: true };
  }

  const text = buildEmbeddingText(media);
  if (!text) {
    // Nothing embeddable yet — drop any stale vector.
    await collection.delete({ ids: [mediaId] });
    return { skipped: true, reason: 'no embeddable text' };
  }

  const [embedding] = await provider.driver.embed({
    credentials: provider.credentials,
    config: provider.config,
    texts: [text],
  });
  await collection.upsert({
    ids: [mediaId],
    embeddings: [embedding],
    documents: [text],
  });
  return { embedded: true };
};

/**
 * Embed the query and return the top-K media ids from Chroma in rank order.
 */
export const semanticSearchIds = async (provider, q, topK = SEMANTIC_TOP_K) => {
  const [queryEmbedding] = await provider.driver.embed({
    credentials: provider.credentials,
    config: provider.config,
    texts: [q],
  });
  const collection = await getCollection();
  const res = await collection.query({ queryEmbeddings: [queryEmbedding], nResults: topK });
  return res.ids?.[0] ?? [];
};

/**
 * Hybrid merger: intersect semantic ids with Meili-filtered hits,
 * preserving semantic rank order.
 */
export const mergeHybrid = (semanticIds, meiliHits) => {
  const byId = new Map(meiliHits.map((h) => [h.id, h]));
  return semanticIds.filter((id) => byId.has(id)).map((id) => byId.get(id));
};

/**
 * mode=semantic search: Chroma top-K ∩ Meili filters (existing filter params apply).
 * Returns hits (Meili docs, semantic order) + hydrated media rows for the UI.
 */
export const searchMediaSemantic = async (provider, params, access = {}) => {
  const q = (params.q ?? '').trim();
  const semanticIds = q ? await semanticSearchIds(provider, q) : [];
  if (!semanticIds.length) {
    return { hits: [], media: [], pagination: { page: 1, limit: SEMANTIC_TOP_K, total: 0, pages: 0 } };
  }

  const { meili } = await import('../../../config/meilisearch.js');
  const { MEDIA_INDEX, buildSearchFilter, buildAccessFilter } = await import('../media-search.service.js');
  const baseFilter = [buildSearchFilter(params), buildAccessFilter(access)].filter(Boolean).join(' AND ');
  const idFilter = `id IN [${semanticIds.map((id) => `"${String(id).replace(/"/g, '\\"')}"`).join(', ')}]`;
  const result = await meili.index(MEDIA_INDEX).search('', {
    filter: baseFilter ? `${idFilter} AND ${baseFilter}` : idFilter,
    limit: SEMANTIC_TOP_K,
  });

  const hits = mergeHybrid(semanticIds, result.hits);
  const ids = hits.map((h) => h.id);
  const rows = ids.length
    ? await prisma.media.findMany({ where: { id: { in: ids }, deleted_at: null } })
    : [];
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const media = ids.map((id) => rowById.get(id)).filter(Boolean);

  return {
    hits,
    media,
    pagination: { page: 1, limit: SEMANTIC_TOP_K, total: hits.length, pages: hits.length ? 1 : 0 },
  };
};

// Fire-and-forget enqueue — embedding upsert must never fail a mutation (mirrors enqueueReindex).
export const enqueueEmbed = (mediaId) => {
  import('../processing.queue.js')
    .then(({ enqueueProcessingJob }) => enqueueProcessingJob('ai-embed', { media_id: mediaId }))
    .catch((err) => logger.warn(`media embed enqueue failed for ${mediaId}: ${err.message}`));
};
