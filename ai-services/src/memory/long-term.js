import { getTenantCollection } from '../knowledge/tenant.js';
import { openrouterEmbed } from '../brains/openrouter.js';
import { scrubInput } from '../governance/compliance.js';

const COLLECTION = 'kdl_long_term_memory';

export async function storeMemory(id, rawDocument, metadata = {}, tenantId) {
  const document = scrubInput(rawDocument);
  const c = await getTenantCollection(COLLECTION, tenantId);
  const embedding = await openrouterEmbed(document);
  await c.upsert({
    ids: [id],
    documents: [document],
    embeddings: [embedding],
    metadatas: [{ ...metadata, stored_at: new Date().toISOString() }],
  });
}

export async function searchMemory(query, nResults = 5, tenantId) {
  const c = await getTenantCollection(COLLECTION, tenantId);
  const embedding = await openrouterEmbed(query);
  const results = await c.query({
    queryEmbeddings: [embedding],
    nResults,
  });
  return (results.documents[0] ?? []).map((doc, i) => ({
    document: doc,
    metadata: results.metadatas[0]?.[i] ?? {},
    distance: results.distances[0]?.[i] ?? null,
  }));
}

export async function deleteMemory(id, tenantId) {
  const c = await getTenantCollection(COLLECTION, tenantId);
  await c.delete({ ids: [id] });
}
