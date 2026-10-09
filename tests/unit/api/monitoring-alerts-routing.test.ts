import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockSendAlert = jest.fn();
const mockGetUserId = jest.fn();
jest.mock('@/lib/alerts', () => ({
  alertManager: { sendAlert: (...args: unknown[]) => mockSendAlert(...args) },
}));
jest.mock('@/lib/auth/jwt-utils', () => ({
  getUserIdFromRequestOrCookies: (...args: unknown[]) => mockGetUserId(...args),
}));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

import { POST } from '@/app/api/monitoring/alerts/route';

const alert = {
  title: 'Review required',
  message: 'Please approve the schedule',
  severity: 'info',
  source: 'test',
};

function request(body: Record<string, unknown>) {
  return createMockNextRequest({
    url: 'http://localhost/api/monitoring/alerts',
    method: 'POST',
    body,
  });
}

beforeEach(() => {
  mockGetUserId.mockResolvedValue('owner-test');
  mockSendAlert.mockResolvedValue([]);
});

it('passes explicit urgency and approval markers to the alert manager', async () => {
  const response = await POST(
    request({ ...alert, urgent: true, requiresApproval: true })
  );
  expect(response.status).toBe(200);
  expect(mockSendAlert).toHaveBeenCalledWith(
    expect.objectContaining({
      ...alert,
      urgent: true,
      requiresApproval: true,
    })
  );
});

it('leaves unmarked monitoring alerts without approval or urgency', async () => {
  await POST(request(alert));
  expect(mockSendAlert).toHaveBeenCalledWith(
    expect.objectContaining({
      urgent: undefined,
      requiresApproval: undefined,
    })
  );
});

it.each(['urgent', 'requiresApproval'])(
  'rejects a string value for %s',
  async marker => {
    expect((await POST(request({ ...alert, [marker]: 'true' }))).status).toBe(
      400
    );
    expect(mockSendAlert).not.toHaveBeenCalled();
  }
);

it('still requires authentication', async () => {
  mockGetUserId.mockResolvedValue(null);
  expect(
    (await POST(request({ ...alert, urgent: true, requiresApproval: true })))
      .status
  ).toBe(401);
  expect(mockSendAlert).not.toHaveBeenCalled();
});
