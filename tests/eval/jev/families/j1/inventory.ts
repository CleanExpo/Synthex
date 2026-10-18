/**
 * J1 (a) inventory: every non-exempt route in the auth-ratchet inventory
 * (isExemptPath, as tests/auth/route-coverage.test.ts uses it).
 *
 * The inventory is FROZEN in tests/eval/jev/cases/J1/routes.json (taken once at P1
 * by inventoryFromTree), as J2 freezes its selection. Listing app/api on every run
 * tied the case count to the tree, so any PR that added or removed a route made the
 * family BROKEN_CHECK although nothing regressed. A frozen route whose file is gone
 * stays in the count and runs INCONCLUSIVE until it is tombstoned.
 */
import { listRoutes, type RouteInfo } from '../../runner/route-harness';
import { isExemptPath } from '../../../../../scripts/auth-coverage-config';
import frozen from '../../cases/J1/routes.json';

export interface J1Route extends RouteInfo {
  /** false when the frozen route file is no longer in the tree. */
  present: boolean;
}

/** The frozen inventory; methods are read from the route file as it is now. */
export function inventory(): J1Route[] {
  const live = new Map(listRoutes().map(r => [r.file, r]));
  return (frozen.routes as { file: string; route: string }[]).map(r => {
    const now = live.get(r.file);
    return { ...r, methods: now?.methods ?? [], present: !!now };
  });
}

/** The inventory rule applied to the current tree; used once to write routes.json. */
export function inventoryFromTree(): RouteInfo[] {
  return listRoutes().filter(r => !isExemptPath(r.file));
}
