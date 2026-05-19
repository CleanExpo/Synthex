import { POST } from '@/app/api/marketing-agency/campaigns/route';
import { generateToken } from '@/lib/auth/jwt-utils';
import { createMockNextRequest } from '@/tests/helpers/mock-request';

describe('marketing agency campaign route', () => {
  it('returns 401 when unauthenticated', async () => {
    const request = createMockNextRequest({
      url: 'http://localhost/api/marketing-agency/campaigns',
      method: 'POST',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorised');
  });

  it('returns a mock campaign package when authenticated', async () => {
    const token = generateToken({ userId: 'user-1', email: 'user@example.com' });
    const request = createMockNextRequest({
      url: 'http://localhost/api/marketing-agency/campaigns',
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.campaignPackage.providerMode).toBe('mock');
    expect(body.campaignPackage.qa.publishGate.status).toBe('blocked');
  });
});
