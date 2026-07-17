import { MeiliSearch } from 'meilisearch';

// Fallback host keeps module import safe when env is absent (tests, tooling);
// the client is lazy and only connects on first request.
// MEILISEARCH_API_KEY must be a scoped API key (search + index operations only),
// NOT the master key. Generate via POST /keys on a master-key-authenticated client.
const meili = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILISEARCH_API_KEY,
});

export { meili };
