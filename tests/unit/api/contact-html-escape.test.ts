/**
 * POST /api/contact — user input is HTML-escaped before entering email HTML.
 *
 * Regression: name/message were interpolated into the notification email's
 * `html:` unescaped, allowing HTML/script injection into the inbox render.
 */
import { createMockNextRequest } from '@/tests/helpers/mock-request';

const mockSend = jest.fn();
// Use a real class (not a jest.fn) so the instance shape survives this repo's
// resetMocks:true, which would otherwise wipe a constructor mockImplementation.
jest.mock('resend', () => ({
  Resend: class {
    emails = { send: (...a: unknown[]) => mockSend(...a) };
  },
}));
// Rate-limit wrapper: pass through to the handler.
jest.mock('@/lib/rate-limit', () => ({
  writeDefault: (_req: unknown, fn: () => unknown) => fn(),
}));

import { POST } from '@/app/api/contact/route';

function req(body: object) {
  return createMockNextRequest({
    method: 'POST',
    url: 'http://localhost/api/contact',
    body,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.RESEND_API_KEY = 'test-key';
  mockSend.mockResolvedValue({ error: null });
});

describe('POST /api/contact — HTML escaping', () => {
  it('escapes angle brackets in name and message', async () => {
    const res = await POST(
      req({
        name: '<script>alert(1)</script>',
        email: 'a@b.com',
        message: 'hi <img src=x onerror=alert(1)> there',
      })
    );

    expect(res.status).toBe(200);
    const html = mockSend.mock.calls[0][0].html as string;
    // Raw tags must not survive into the email body.
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
  });
});
