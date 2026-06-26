import { MeiliSearch } from 'meilisearch';

const meili = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST,
  apiKey: process.env.MEILISEARCH_API_KEY,
});

export { meili };
