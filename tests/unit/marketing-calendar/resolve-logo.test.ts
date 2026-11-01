/**
 * A logo URL is written only when it serves an image, and a host that never
 * answers counts as not serving it rather than hanging the setup run.
 */
import {
  LOGO_CHECK_TIMEOUT_MS,
  resolveLogoUrl,
} from '@/lib/marketing-calendar/resolve-logo';

const LOGO = 'https://example.test/logo.png';
const realFetch = global.fetch;
const answer = (type: string) => ({ ok: true, headers: { get: () => type } });

afterEach(() => {
  global.fetch = realFetch;
});

describe('resolveLogoUrl', () => {
  it('bounds the HEAD check with a timeout signal', async () => {
    const fetchMock = jest.fn().mockResolvedValue(answer('image/png'));
    global.fetch = fetchMock as unknown as typeof fetch;
    expect(await resolveLogoUrl(LOGO)).toBe(LOGO);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('HEAD');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(LOGO_CHECK_TIMEOUT_MS).toBeGreaterThan(0);
    expect(LOGO_CHECK_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });

  it('treats a timed-out or non-image answer as not served', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new DOMException('timed out', 'TimeoutError')
      ) as unknown as typeof fetch;
    expect(await resolveLogoUrl(LOGO)).toBeNull();
    global.fetch = jest
      .fn()
      .mockResolvedValue(answer('text/html')) as unknown as typeof fetch;
    expect(await resolveLogoUrl(LOGO)).toBeNull();
  });
});
