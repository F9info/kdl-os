import { chroma } from '../config/chroma.js';
import { openrouterEmbed } from '../brains/openrouter.js';

const COLLECTION = 'kdl_knowledge';

let col = null;

async function getCollection() {
  if (!col) {
    col = await chroma.getOrCreateCollection({ name: COLLECTION });
  }
  return col;
}

export async function retrieveChunks(query, nResults = 5) {
  const c = await getCollection();
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
