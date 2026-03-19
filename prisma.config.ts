import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  envFilePath: '.env.local',
  migrations: {
    seed: 'node prisma/seed.js',
  },
});
