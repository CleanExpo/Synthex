/**
 * Honest status for features whose backing table is not in prisma/schema.prisma.
 *
 * Routes that need a missing table answer 503 (NOT_PROVISIONED_STATUS) with
 * notProvisionedBody() or notProvisionedResponse(), or attach tableUnavailable() to an otherwise-real
 * response, instead of returning empty data or silently dropping a write.
 */

import { NextResponse } from 'next/server';

export const FEATURE_NOT_PROVISIONED = 'FEATURE_NOT_PROVISIONED';

/** Spec 2026-10-17: a route whose backing table is missing answers 503. */
export const NOT_PROVISIONED_STATUS = 503;

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

/** 503 FEATURE_NOT_PROVISIONED response with a route-specific message. */
export function notProvisionedResponse(
  message: string,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    { error: FEATURE_NOT_PROVISIONED, message, ...extra },
    { status: NOT_PROVISIONED_STATUS }
  );
}
