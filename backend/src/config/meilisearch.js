import { MeiliSearch } from 'meilisearch';

// MEILISEARCH_API_KEY must be a SCOPED ADMIN key (documents + indexes + settings
// actions on the app's indexes), never the instance master key. The master key
// (MEILI_MASTER_KEY) can mint new keys and administer the whole instance — it
// belongs only in the Meilisearch container env. Generate a scoped key via the
// /keys endpoint; see .env.example. (KDL-270 L16)
//
// Fallback host keeps module import safe when env is absent (tests, tooling);
// the client is lazy and only connects on first request.
const meili = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILISEARCH_API_KEY,
});

export { meili };
