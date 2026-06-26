import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Load the project-root .env so the Prisma CLI (migrate / db push / studio / seed)
// can reach DATABASE_URL. The runtime client loads env via `dotenv/config` itself.
const __dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dir, '..', '.env') });

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'node prisma/seed.js',
  },
  // Prisma 7 drops the datasource `url`; the CLI connects through this adapter,
  // mirroring the runtime adapter in src/config/database.js.
  adapter: async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    return new PrismaPg(pool);
  },
});
