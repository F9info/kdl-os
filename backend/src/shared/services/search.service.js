import { meili } from '../../config/meilisearch.js';

export const indexDocuments = async (indexName, documents) => {
  const index = meili.index(indexName);
  return index.addDocuments(documents);
};

export const searchDocuments = async (indexName, query, options = {}) => {
  const index = meili.index(indexName);
  return index.search(query, options);
};

export const deleteDocument = async (indexName, id) => {
  const index = meili.index(indexName);
  return index.deleteDocument(id);
};

export const ensureIndex = async (indexName, primaryKey = 'id') => {
  try {
    await meili.getIndex(indexName);
  } catch {
    await meili.createIndex(indexName, { primaryKey });
  }
};
