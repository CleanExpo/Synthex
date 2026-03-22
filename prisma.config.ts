import { defineConfig } from 'prisma/config';
import { config as loadEnv } from 'dotenv';

// Prisma 6 skips .env auto-loading when this config file is present — load it manually.
//
// Load order:
//   1. .env.local — user-specific overrides (highest priority; already in process.env via dotenvx)
//   2. .env       — base config that fills gaps (e.g. DIRECT_URL not in .env.local)
// dotenv's default behaviour: does NOT override vars already set, so .env.local always wins.
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' }); // fills DIRECT_URL and any other vars absent from .env.local

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'node prisma/seed.js',
  },
});
