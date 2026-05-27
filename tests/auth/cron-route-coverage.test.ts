/**
 * Cron route coverage regression test — SYN-971.
 *
 * Vercel cron targets are public HTTP routes. Every configured cron route must
 * exist on disk and use the shared cron auth helper so spoofable headers or
 * ad hoc fallbacks do not bypass CRON_SECRET enforcement.
 */

import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function routePathForApiPath(apiPath: string): string {
  const trimmed = apiPath.replace(/^\/+/, '');
  return path.join(REPO_ROOT, 'app', trimmed, 'route.ts');
}

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

describe('Cron route coverage', () => {
  const vercelJsonPath = path.join(REPO_ROOT, 'vercel.json');
  const vercelJson = JSON.parse(read(vercelJsonPath)) as {
    crons?: Array<{ path: string; schedule: string }>;
  };

  it('has configured Vercel cron entries to validate', () => {
    expect(vercelJson.crons?.length ?? 0).toBeGreaterThan(0);
  });

  it('all Vercel cron entries point to existing route files using verifyCronRequest', () => {
    const failures: string[] = [];

    for (const cron of vercelJson.crons ?? []) {
      const routePath = routePathForApiPath(cron.path);
      if (!fs.existsSync(routePath)) {
        failures.push(`${cron.path} -> missing ${path.relative(REPO_ROOT, routePath)}`);
        continue;
      }

      const content = read(routePath);
      if (!content.includes('verifyCronRequest')) {
        failures.push(`${cron.path} -> missing verifyCronRequest`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('all /api/cron route files use verifyCronRequest', () => {
    const cronRoutes = globSync('app/api/cron/**/route.ts', {
      cwd: REPO_ROOT,
      absolute: true,
    });

    expect(cronRoutes.length).toBeGreaterThan(0);

    const missing = cronRoutes
      .filter(routePath => !read(routePath).includes('verifyCronRequest'))
      .map(routePath => path.relative(REPO_ROOT, routePath));

    expect(missing).toEqual([]);
  });
});
