import fs from 'node:fs';
import path from 'node:path';

describe('Vercel build command', () => {
  it('uses the migration-safe production build pipeline', () => {
    const root = process.cwd();
    const vercelConfig = JSON.parse(
      fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')
    ) as { buildCommand?: string };
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    ) as { scripts?: Record<string, string> };

    expect(vercelConfig.buildCommand).toBe('npm run build:vercel');
    expect(packageJson.scripts?.['build:vercel']).toBe(
      'sh scripts/build-with-migrations.sh'
    );

    const buildScript = fs.readFileSync(
      path.join(root, 'scripts/build-with-migrations.sh'),
      'utf8'
    );
    expect(buildScript).toContain('PRISMA_CLI="./node_modules/.bin/prisma"');
    expect(buildScript).toContain('"$PRISMA_CLI" generate');
    expect(buildScript).toContain('"$PRISMA_CLI" migrate deploy');
    expect(buildScript).not.toContain('npx prisma');
  });
});
