/**
 * Honest status for features whose backing table is not in prisma/schema.prisma.
 *
 * Routes that need a missing table answer 501 with notProvisionedBody(), or
 * attach tableUnavailable() to an otherwise-real response, instead of
 * returning empty data or silently dropping a write.
 */

export const FEATURE_NOT_PROVISIONED = 'FEATURE_NOT_PROVISIONED';

export function notProvisionedBody(table: string, feature: string) {
  return {
    error: FEATURE_NOT_PROVISIONED,
    message: `${feature} is not available: the ${table} table is not provisioned.`,
  };
}

export function tableUnavailable(table: string) {
  return {
    available: false as const,
    reason: `${FEATURE_NOT_PROVISIONED}: the ${table} table is not provisioned; nothing was read or saved.`,
  };
}
