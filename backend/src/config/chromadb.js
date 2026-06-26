import { ChromaClient } from 'chromadb';

const chroma = new ChromaClient({
  path: process.env.CHROMADB_URL,
});

export { chroma };
