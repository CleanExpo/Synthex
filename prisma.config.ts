import { defineConfig } from 'prisma/config';
import { config as loadEnv } from 'dotenv';

// Prisma 6 skips .env auto-loading when this config file is present — load it manually
loadEnv({ path: '.env.local' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'node prisma/seed.js',
  },
});
