import pLimit from 'p-limit';
import { getTenantCollection } from './tenant.js';
import { openrouterEmbed } from '../brains/openrouter.js';
import { randomUUID } from 'crypto';
import { scrubInput } from '../governance/compliance.js';

const COLLECTION = 'kdl_knowledge';
const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 64;
const EMBED_CONCURRENCY = 10;

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
  }
  return chunks;
}

export async function ingestDocument(content, metadata = {}, tenantId) {
  const c = await getTenantCollection(COLLECTION, tenantId);
  // Scrub before embedding: PII stored in the vector store is returned to other users' prompts later.
  const chunks = chunkText(scrubInput(content));
  const ids = chunks.map(() => randomUUID());
  const limit = pLimit(EMBED_CONCURRENCY);
  const embeddings = await Promise.all(chunks.map((chunk) => limit(() => openrouterEmbed(chunk))));

  await c.upsert({
    ids,
    documents: chunks,
    embeddings,
    metadatas: chunks.map((_, i) => ({
      ...metadata,
      chunk_index: i,
      total_chunks: chunks.length,
      ingested_at: new Date().toISOString(),
    })),
  });

  return { chunks: chunks.length, ids };
}
