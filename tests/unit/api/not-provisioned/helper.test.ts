/**
 * Spec 2026-10-17 §P2: a route whose backing table does not exist returns an
 * explicit 503 with the code FEATURE_NOT_PROVISIONED.
 *
 * SEAM: notProvisionedResponse() from lib/api/not-provisioned, the shared
 * helper routes return. Catches a wrong status or error code on the helper;
 * misses routes that build the response by hand.
 */

/** @jest-environment node */

import { notProvisionedResponse } from '@/lib/api/not-provisioned';

describe('notProvisionedResponse', () => {
  it('answers 503 with error FEATURE_NOT_PROVISIONED', async () => {
    const res = notProvisionedResponse('Widgets are not available.', {
      available: false,
    });

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: 'FEATURE_NOT_PROVISIONED',
      message: 'Widgets are not available.',
      available: false,
    });
  });
});
