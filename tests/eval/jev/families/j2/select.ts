/**
 * J2 route selection: 180 authenticated GET read routes, picked by rule from the tree.
 *
 * Candidate: exports GET, authenticates a user (JWT helper, withAuth or
 * APISecurityChecker), is not cron-authenticated, reads data (imports lib/prisma,
 * lib/platform/noop-client or a lib/services module), and is not an auth flow,
 * webhook, stream or binary download. Ranked noop-client importers first, then
 * dashboards/analytics/reports/integrations/platform reads, then static paths,
 * then dynamic paths; sorted by file within each rank. The first 180 are taken
 * and returned sorted by file.
 */
import fs from 'fs';
import path from 'path';
import { listRoutes, type RouteInfo } from '../../runner/route-harness';

export const J2_CASE_COUNT = 180;
const ROOT = path.join(__dirname, '../../../../..');

const USER_AUTH =
  /APISecurityChecker|getUserIdFromRequestOrCookies|getUserIdFromRequest\b|lib\/auth\/with-auth|lib\/auth\/with-org|requireAuth|authenticateRequest/;
const DATA = /@\/lib\/prisma'|lib\/platform\/noop-client|@\/lib\/services\//;
const EXCLUDED_PATH =
  /\/(auth|oauth|callback|callbacks|webhook|webhooks|cron|stream|sse|events|realtime|pdf|image|download|export|og|redirect)(\/|$)/;
const CATEGORY =
  /(dashboard|analytics|report|integration|platform|insight|metric|stat)/;

export interface J2Route extends RouteInfo {
  noop: boolean;
  id: string;
}

/** J2-<slug>, path segments joined by '.': app/api/brand/[id]/route.ts -> J2-brand.id */
export function caseId(file: string): string {
  const slug = path
    .dirname(file)
    .replace(/^app\/api\/?/, '')
    .split('/')
    .map(seg => seg.replace(/[^A-Za-z0-9-]+/g, '').toLowerCase())
    .filter(Boolean)
    .join('.');
  return `J2-${slug || 'root'}`;
}

export function selectRoutes(): J2Route[] {
  const ranked: { rank: number; route: J2Route }[] = [];
  for (const r of listRoutes()) {
    if (!r.methods.includes('GET')) continue;
    if (EXCLUDED_PATH.test(r.route)) continue;
    const src = fs.readFileSync(path.join(ROOT, r.file), 'utf8');
    if (!USER_AUTH.test(src) || /cron-auth/.test(src) || !DATA.test(src))
      continue;
    const noop = /lib\/platform\/noop-client/.test(src);
    const rank = noop
      ? 0
      : CATEGORY.test(r.route)
        ? 1
        : r.route.includes('[')
          ? 3
          : 2;
    ranked.push({ rank, route: { ...r, noop, id: caseId(r.file) } });
  }
  ranked.sort((a, b) =>
    a.rank !== b.rank
      ? a.rank - b.rank
      : a.route.file < b.route.file
        ? -1
        : a.route.file > b.route.file
          ? 1
          : 0
  );
  return ranked
    .slice(0, J2_CASE_COUNT)
    .map(x => x.route)
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}
