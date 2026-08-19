/**
 * PR export gate (AT-014)
 *
 * Distribution / publish is blocked until an owner or admin clears the release
 * to status `approved` (posts:approve | organization:manage). Fail closed for
 * draft, archived, and any unknown status.
 *
 * @module lib/pr/export-gate
 */

import { NextResponse } from 'next/server';
import type { AgencyPermissionCheck } from '@/lib/agency/agency-api-auth';

export const PR_EXPORT_GATE_ID = 'pr-export' as const;
export const PR_EXPORT_AGENCY_TASK_ID = 'AT-014' as const;

/** Statuses that may proceed to distribute / publish. */
export const PR_EXPORT_CLEARED_STATUSES = new Set(['approved', 'published']);

/** Owner/admin clearance — used when stamping status → approved. */
export const PR_EXPORT_APPROVE_PERMISSIONS: AgencyPermissionCheck[] = [
  { resource: 'posts', action: 'approve' },
  { resource: 'organization', action: 'manage' },
];

export function isPrExportCleared(status: string): boolean {
  return PR_EXPORT_CLEARED_STATUSES.has(status);
}

export function prExportBlockedResponse(status: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Export blocked',
      message:
        `Press release must be approved before export (current status: ${status}). ` +
        'An owner or admin must set status to approved first.',
      gate: PR_EXPORT_GATE_ID,
      agencyTaskId: PR_EXPORT_AGENCY_TASK_ID,
    },
    { status: 403 }
  );
}
