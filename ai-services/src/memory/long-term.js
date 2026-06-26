import { chroma } from '../config/chroma.js';
import { openrouterEmbed } from '../brains/openrouter.js';

const COLLECTION = 'kdl_long_term_memory';

let col = null;

async function getCollection() {
  if (!col) {
    col = await chroma.getOrCreateCollection({ name: COLLECTION });
  }
  return col;
}

export async function storeMemory(id, document, metadata = {}) {
  const c = await getCollection();
  const embedding = await openrouterEmbed(document);
  await c.upsert({
    ids: [id],
    documents: [document],
    embeddings: [embedding],
    metadatas: [{ ...metadata, stored_at: new Date().toISOString() }],
  });
}

export async function searchMemory(query, nResults = 5) {
  const c = await getCollection();
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

export async function deleteMemory(id) {
  const c = await getCollection();
  await c.delete({ ids: [id] });
}
