import {
  isPrExportCleared,
  PR_EXPORT_APPROVE_PERMISSIONS,
  PR_EXPORT_AGENCY_TASK_ID,
  PR_EXPORT_GATE_ID,
  prExportBlockedResponse,
} from '@/lib/pr/export-gate';

describe('lib/pr/export-gate', () => {
  it('clears only approved and published', () => {
    expect(isPrExportCleared('approved')).toBe(true);
    expect(isPrExportCleared('published')).toBe(true);
    expect(isPrExportCleared('draft')).toBe(false);
    expect(isPrExportCleared('archived')).toBe(false);
    expect(isPrExportCleared('')).toBe(false);
  });

  it('approve permissions match posts:approve or organization:manage', () => {
    expect(PR_EXPORT_APPROVE_PERMISSIONS).toEqual([
      { resource: 'posts', action: 'approve' },
      { resource: 'organization', action: 'manage' },
    ]);
  });

  it('blocked response is fail-closed 403 with AT-014 markers', async () => {
    const res = prExportBlockedResponse('draft');
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: 'Export blocked',
      gate: PR_EXPORT_GATE_ID,
      agencyTaskId: PR_EXPORT_AGENCY_TASK_ID,
    });
  });
});
