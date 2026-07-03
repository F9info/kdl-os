import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '..', '.env') });

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'node prisma/seed.js',
  },
  adapter: async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    return new PrismaPg(pool);
  },
});
