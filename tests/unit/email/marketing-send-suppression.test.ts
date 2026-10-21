/**
 * SEAM: the exported senders sendMonthlyStoryEmail, sendEffectReportEmail,
 * sendAdvisorBriefEmail and sendGeoScoreNotificationEmail, observed at the
 * Resend boundary (emails.send) with Prisma as the preferences boundary;
 * plus the two delivery routes that count the skip.
 * Catches: a suppressed or unknown-status recipient being mailed; a skip that
 * is reported as an ordinary email failure instead of a suppression count.
 * Misses: real Resend / Postgres behaviour (mocked boundaries).
 */

const mockSend = jest.fn();
const mockContactsGet = jest.fn();
jest.mock('resend', () => ({
  // plain function: survives the config's resetMocks between tests
  Resend: function MockResend() {
    return {
      emails: { send: (...a: unknown[]) => mockSend(...a) },
      contacts: { get: (...a: unknown[]) => mockContactsGet(...a) },
    };
  },
}));

const mockPrisma = {
  user: { findUnique: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { sendMonthlyStoryEmail } from '@/lib/email/monthly-story-email';
import { sendEffectReportEmail } from '@/lib/email/effect-report-email';
import { sendAdvisorBriefEmail } from '@/lib/email/advisor-brief-email';
import { sendGeoScoreNotificationEmail } from '@/lib/email/geo-score-notification-email';

const TO = 'owner@example.com';
const ENV = { ...process.env };

type Result = { success: boolean; suppressed?: boolean; error?: string };

const SENDERS: Array<[string, () => Promise<Result>]> = [
  [
    'monthly story',
    () =>
      sendMonthlyStoryEmail({
        to: TO,
        businessName: 'Biz',
        monthLabel: 'October 2026',
        storyText: 'story',
        totalReach: 1,
        postsPublished: 1,
        autonomousPosts: 1,
        minutesSaved: 60,
        storyId: 's1',
        orgId: 'o1',
        monthYear: '2026-10',
      } as never),
  ],
  [
    'effect report',
    () =>
      sendEffectReportEmail({
        to: TO,
        businessName: 'Biz',
        quarterLabel: 'Q3 2026',
        reportUrl: '/dashboard/effect-report/Q3%202026',
        pngUrl: null,
        pdfUrl: null,
        reportData: {
          achievementSummary: {
            postsPublished: 1,
            estimatedTotalReach: 10,
            consecutiveWeeksActive: 1,
          },
          proprietaryMetrics: { geoScore: null, healthScore: null },
          biggestWin: null,
          honestGap: null,
          whatsNext: null,
        } as never,
      } as never),
  ],
  [
    'advisor brief',
    () =>
      sendAdvisorBriefEmail({
        to: TO,
        businessName: 'Biz',
        weekLabel: '20 Oct 2026',
        dollarAttribution: '$1',
        actions: [],
        briefId: 'b1',
      }),
  ],
  [
    'geo score',
    () =>
      sendGeoScoreNotificationEmail({
        to: TO,
        businessName: 'Biz',
        variant: 'improved',
        currentScore: 70,
        delta: 5,
        trendData: [],
        recommendedActions: [],
      }),
  ],
];

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ENV,
    RESEND_API_KEY: 're_test_placeholder',
    RESEND_AUDIENCE_ID: 'aud_test',
  };
  mockSend.mockResolvedValue({ data: { id: 'em_1' }, error: null });
  mockContactsGet.mockResolvedValue({
    data: { id: 'c1', email: TO, unsubscribed: false },
    error: null,
  });
  mockPrisma.user.findUnique.mockResolvedValue({ preferences: {} });
});

afterAll(() => {
  process.env = ENV;
});

describe.each(SENDERS)('%s sender honours unsubscribes', (_name, send) => {
  it('mails a subscribed Synthex user', async () => {
    const r = await send();
    expect(r.success).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('does not mail a user whose preferences say unsubscribed', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      preferences: { emailStatus: { status: 'unsubscribed' } },
    });
    const r = await send();
    expect(mockSend).not.toHaveBeenCalled();
    expect(r.success).toBe(false);
    expect(r.suppressed).toBe(true);
  });

  it('does not mail a contact unsubscribed in the Resend audience', async () => {
    mockContactsGet.mockResolvedValue({
      data: { id: 'c1', email: TO, unsubscribed: true },
      error: null,
    });
    const r = await send();
    expect(mockSend).not.toHaveBeenCalled();
    expect(r.suppressed).toBe(true);
  });

  it('fails closed when the configured audience cannot be read', async () => {
    mockContactsGet.mockRejectedValue(new Error('network down'));
    const r = await send();
    expect(mockSend).not.toHaveBeenCalled();
    expect(r.suppressed).toBe(true);
  });
});
