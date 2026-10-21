/**
 * SEAM: lib/email/suppression.ts — getSuppressionStatus(email, { preferences? }),
 * recordUnsubscribe(email) and UnifiedEmailService.canSendTo(email).
 * Catches: an unsubscribed or invalid address being reported sendable; an
 * unreadable store (Resend error, audience unset, DB throw, unknown recipient)
 * being reported sendable instead of 'unknown'; an unsubscribe that is not
 * written to a store the send-time check reads.
 * Misses: real Resend / Postgres behaviour (both are mocked boundaries here).
 */

const mockContactsGet = jest.fn();
const mockContactsUpdate = jest.fn();
const mockContactsCreate = jest.fn();
jest.mock('resend', () => ({
  // plain function: survives the config's resetMocks between tests
  Resend: function MockResend() {
    return {
      contacts: {
        get: (...a: unknown[]) => mockContactsGet(...a),
        update: (...a: unknown[]) => mockContactsUpdate(...a),
        create: (...a: unknown[]) => mockContactsCreate(...a),
      },
    };
  },
}));

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/email/queue', () => ({
  emailQueue: { enqueue: jest.fn(), sendImmediate: jest.fn() },
}));

import {
  getSuppressionStatus,
  recordUnsubscribe,
} from '@/lib/email/suppression';
// lib/email.ts shadows the lib/email/ directory, so name index explicitly.
import { email as emailService } from '@/lib/email/index';

const ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ENV,
    RESEND_API_KEY: 're_test_placeholder',
    RESEND_AUDIENCE_ID: 'aud_test',
  };
  mockContactsGet.mockResolvedValue({
    data: { id: 'c1', email: 'x@example.com', unsubscribed: false },
    error: null,
  });
  mockContactsUpdate.mockResolvedValue({ data: { id: 'c1' }, error: null });
  mockContactsCreate.mockResolvedValue({ data: { id: 'c2' }, error: null });
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', preferences: {} });
  mockPrisma.user.update.mockResolvedValue({});
});

afterAll(() => {
  process.env = ENV;
});

describe('getSuppressionStatus', () => {
  it('allows a user with no emailStatus who is subscribed in Resend', async () => {
    const s = await getSuppressionStatus('x@example.com', { preferences: {} });
    expect(s.state).toBe('allowed');
  });

  it('allows a user who is not in the Resend audience (not_found)', async () => {
    mockContactsGet.mockResolvedValue({
      data: null,
      error: { name: 'not_found', message: 'Contact not found' },
    });
    const s = await getSuppressionStatus('x@example.com', { preferences: {} });
    expect(s.state).toBe('allowed');
  });

  it('suppresses a user whose preferences say unsubscribed', async () => {
    const s = await getSuppressionStatus('x@example.com', {
      preferences: { emailStatus: { status: 'unsubscribed' } },
    });
    expect(s.state).toBe('suppressed');
  });

  it('suppresses a user whose preferences say invalid (bounce/complaint)', async () => {
    const s = await getSuppressionStatus('x@example.com', {
      preferences: JSON.stringify({ emailStatus: { status: 'invalid' } }),
    });
    expect(s.state).toBe('suppressed');
  });

  it('suppresses a contact marked unsubscribed in the Resend audience', async () => {
    mockContactsGet.mockResolvedValue({
      data: { id: 'c1', email: 'x@example.com', unsubscribed: true },
      error: null,
    });
    const s = await getSuppressionStatus('x@example.com', { preferences: {} });
    expect(s.state).toBe('suppressed');
  });

  it('is unknown (fail closed) when RESEND_AUDIENCE_ID is unset', async () => {
    delete process.env.RESEND_AUDIENCE_ID;
    const s = await getSuppressionStatus('x@example.com', { preferences: {} });
    expect(s.state).toBe('unknown');
  });

  it('is unknown (fail closed) when Resend returns a non-not_found error', async () => {
    mockContactsGet.mockResolvedValue({
      data: null,
      error: { name: 'rate_limit_exceeded', message: 'slow down' },
    });
    const s = await getSuppressionStatus('x@example.com', { preferences: {} });
    expect(s.state).toBe('unknown');
  });

  it('is unknown (fail closed) when the Resend call throws', async () => {
    mockContactsGet.mockRejectedValue(new Error('network down'));
    const s = await getSuppressionStatus('x@example.com', { preferences: {} });
    expect(s.state).toBe('unknown');
  });

  it('is unknown (fail closed) when the preferences read throws', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('db down'));
    const s = await getSuppressionStatus('x@example.com');
    expect(s.state).toBe('unknown');
  });

  it('is unknown (fail closed) for an address that is not a Synthex user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const s = await getSuppressionStatus('stranger@example.com');
    expect(s.state).toBe('unknown');
  });
});

describe('canSendTo delegates to the suppression check', () => {
  it('refuses an unknown address (previously allowed)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(emailService.canSendTo('stranger@example.com')).resolves.toBe(
      false
    );
  });

  it('allows a known, subscribed user', async () => {
    await expect(emailService.canSendTo('x@example.com')).resolves.toBe(true);
  });
});

describe('recordUnsubscribe', () => {
  it('writes the Resend audience and the user preferences emailStatus', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      preferences: { theme: 'dark' },
    });
    const r = await recordUnsubscribe('x@example.com', 'one-click');
    expect(r.recorded.sort()).toEqual(['preferences', 'resend']);
    expect(r.failed).toEqual([]);
    expect(mockContactsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        audienceId: 'aud_test',
        email: 'x@example.com',
        unsubscribed: true,
      })
    );
    const written = mockPrisma.user.update.mock.calls[0][0];
    expect(written.where).toEqual({ id: 'u1' });
    expect(written.data.preferences.theme).toBe('dark');
    expect(written.data.preferences.emailStatus.status).toBe('unsubscribed');
  });

  it('creates an unsubscribed Resend contact when the address is not in the audience', async () => {
    mockContactsUpdate.mockResolvedValue({
      data: null,
      error: { name: 'not_found', message: 'Contact not found' },
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const r = await recordUnsubscribe('stranger@example.com', 'form');
    expect(r.recorded).toEqual(['resend']);
    expect(mockContactsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        audienceId: 'aud_test',
        email: 'stranger@example.com',
        unsubscribed: true,
      })
    );
  });

  it('records nothing and reports it when no store is available', async () => {
    delete process.env.RESEND_AUDIENCE_ID;
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const r = await recordUnsubscribe('stranger@example.com', 'form');
    expect(r.recorded).toEqual([]);
    expect(r.failed).toEqual([]);
  });

  it('reports a failed store when the Resend write errors', async () => {
    mockContactsUpdate.mockResolvedValue({
      data: null,
      error: { name: 'internal_server_error', message: 'boom' },
    });
    const r = await recordUnsubscribe('x@example.com', 'form');
    expect(r.failed).toEqual(['resend']);
  });
});
