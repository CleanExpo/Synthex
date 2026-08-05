/**
 * Match rows for the caller's effective organisation, including legacy rows
 * that incorrectly stored the user id in `orgId` before this was fixed.
 *
 * Use on reads/updates/deletes only. Creates must write `organizationId`.
 */
export function orgIdScope(organizationId: string, userId: string) {
  return {
    OR: [{ orgId: organizationId }, { orgId: userId }],
  };
}
