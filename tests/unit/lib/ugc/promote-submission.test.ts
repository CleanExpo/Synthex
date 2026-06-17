/**
 * Unit test — promoteApprovedSubmission (backlog #6 content-pipeline worker).
 *
 * Isolates the worker's own gates by mocking the (separately-tested)
 * persistPublishSlot primitive and prisma:
 *   - org-scoped read is the cross-org guard (not-found → SubmissionNotFoundError)
 *   - only an `approved` submission promotes (else SubmissionNotApprovedError)
 *   - platform is the explicit arg, else the linked creator's platform, else throw
 *   - the caption is what gets shaped into the slot; delegation is forwarded intact.
 */

const findFirstUgc = jest.fn();
const persistPublishSlotMock = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    ugcSubmission: {
      findFirst: (...a: unknown[]) => findFirstUgc(...a),
    },
  },
}));

jest.mock('@/lib/workflow/persist-publish-slot', () => ({
  persistPublishSlot: (...a: unknown[]) => persistPublishSlotMock(...a),
}));

import {
  promoteApprovedSubmission,
  SubmissionNotFoundError,
  SubmissionNotApprovedError,
  MissingPlatformError,
} from '@/lib/ugc/promote-submission';

const SCHEDULED_AT = new Date('2026-06-20T09:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  findFirstUgc.mockResolvedValue({
    id: 'ugc-1',
    organizationId: 'org-1',
    status: 'approved',
    caption: 'Loving this! #ad',
    creator: { platform: 'instagram' },
  });
  persistPublishSlotMock.mockResolvedValue({
    calendarId: 'cal-1',
    slotId: 'slot-1',
  });
});

function run(overrides: Record<string, unknown> = {}) {
  return promoteApprovedSubmission({
    organizationId: 'org-1',
    submissionId: 'ugc-1',
    calendarId: 'cal-1',
    scheduledAt: SCHEDULED_AT,
    ...overrides,
  });
}

describe('promoteApprovedSubmission', () => {
  test('cross-org / missing submission → SubmissionNotFoundError, no persist', async () => {
    findFirstUgc.mockResolvedValue(null);
    await expect(run({ submissionId: 'ugc-999' })).rejects.toBeInstanceOf(
      SubmissionNotFoundError
    );
    expect(persistPublishSlotMock).not.toHaveBeenCalled();
    // the read is org-scoped — the cross-org guard
    expect(findFirstUgc.mock.calls[0][0].where).toEqual({
      id: 'ugc-999',
      organizationId: 'org-1',
    });
  });

  test('not-approved submission → SubmissionNotApprovedError, no persist', async () => {
    findFirstUgc.mockResolvedValue({
      id: 'ugc-1',
      organizationId: 'org-1',
      status: 'pending',
      caption: 'x',
      creator: { platform: 'instagram' },
    });
    await expect(run()).rejects.toBeInstanceOf(SubmissionNotApprovedError);
    expect(persistPublishSlotMock).not.toHaveBeenCalled();
  });

  test('no platform arg and no creator platform → MissingPlatformError', async () => {
    findFirstUgc.mockResolvedValue({
      id: 'ugc-1',
      organizationId: 'org-1',
      status: 'approved',
      caption: 'x',
      creator: null,
    });
    await expect(run()).rejects.toBeInstanceOf(MissingPlatformError);
    expect(persistPublishSlotMock).not.toHaveBeenCalled();
  });

  test('platform defaults to the linked creator platform', async () => {
    await run();
    expect(persistPublishSlotMock.mock.calls[0][0]).toMatchObject({
      organizationId: 'org-1',
      calendarId: 'cal-1',
      platform: 'instagram',
      content: 'Loving this! #ad',
      scheduledAt: SCHEDULED_AT,
    });
  });

  test('explicit platform arg overrides the creator platform', async () => {
    await run({ platform: 'tiktok' });
    expect(persistPublishSlotMock.mock.calls[0][0].platform).toBe('tiktok');
  });

  test('null caption forwards an empty content string', async () => {
    findFirstUgc.mockResolvedValue({
      id: 'ugc-1',
      organizationId: 'org-1',
      status: 'approved',
      caption: null,
      creator: { platform: 'instagram' },
    });
    await run();
    expect(persistPublishSlotMock.mock.calls[0][0].content).toBe('');
  });

  test('happy path → returns calendar + slot + submission ids', async () => {
    const result = await run();
    expect(result).toEqual({
      calendarId: 'cal-1',
      slotId: 'slot-1',
      submissionId: 'ugc-1',
    });
  });
});
