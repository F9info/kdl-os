import { getTenantCollection } from './tenant.js';
import { openrouterEmbed } from '../brains/openrouter.js';

const COLLECTION = 'kdl_knowledge';

export async function retrieveChunks(query, nResults = 5, tenantId) {
  const c = await getTenantCollection(COLLECTION, tenantId);
  const embedding = await openrouterEmbed(query);
  const results = await c.query({
    queryEmbeddings: [embedding],
    nResults,
  });
  return (results.documents[0] ?? []).map((doc, i) => ({
    content: doc,
    metadata: results.metadatas[0]?.[i] ?? {},
    distance: results.distances[0]?.[i] ?? null,
  }));
}
